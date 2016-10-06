var _ = require('lodash'),
  async = require('async'),
  crypto = require('crypto'),
  fs = require('fs'),
  uuid = require('uuid'),
  utils = require('../../utils');

exports.abortExecution = function abortExecution(execution, logger, done) {
  var connection;
  logger = utils.logger.shim(logger, 'abortExecution');

  return async.series([
    getConnection,
    abortConcourseExecution,
    destroyConcoursePipeline,
    execution.save.bind(execution)
  ], done);

  function getConnection(callback) {
    utils.database.connection((err, conn) => {
      connection = conn;
      return callback(err);
    });
  }

  function abortConcourseExecution(callback) {
    return utils.concourse
      .client(utils.settings.concourse, logger)
      .abortPipeline(
        execution.concourse_pipeline_id,
        execution.id,
        (err) => {
          if (err) {
            logger.warn('Unable to abort concourse pipeline');
            logger.warn(err.message);
          }

          // Even if we can't abort it, we can still destroy it.
          // Swallow this error.
          return callback();
        });
  }

  function destroyConcoursePipeline(callback) {
    return utils.concourse
      .client(utils.settings.concourse, logger)
      .destroyPipeline(
        execution.concourse_pipeline_id,
        (err) => {
          if (err) {
            logger.warn('Unable to destroy concourse pipeline');
            logger.warn(err.message);
          }
          execution.result = 'Timed Out';
          return callback();
        });
  }
};

exports.startExecution = function startExecution(eventType, project, commit, logger, done) {
  var connection;
  logger = utils.logger.shim(logger, 'startExecution');

  utils.settings.getSystemConfigurationValue('pipeline_creation_enabled', (err, pipelineCreationEnabled) => {
    if (err) {
      return done(err);
    }

    if (pipelineCreationEnabled === "1") {
      return async.waterfall([
          utils.database.connection,
          getCloudFoundryTarget,
          getNotificationTargets,
          getPipelineTasks,
          getApplicationDockerContainer,
          getBuildContainer,
          createExecutionRow,
          loadSystemImages,
          getPipelineTemplateFile,
          startConcourseExecution,
          updateExecutionRow
        ], done);
    } else {
      err = new Error("Server Maintenance");
      err.status = 503;
      return done(err);
    }
  });

  function getCloudFoundryTarget(conn, callback) {
    connection = conn;
    project.getDeploymentTarget((err, target) => {
      if (err || !target) {
        err = err || new Error(`No target was returned for project with id:${project.id}`);
        return callback(err);
      }

      return callback(err, target);
    });
  }

  function getNotificationTargets(target, callback) {
    var supportedNotificationTargets = []
    project.getNotificationTargets((err, notificationTargets) => {
      notificationTargets = notificationTargets || [];
      _.each(notificationTargets, (nTarget, index) => {
        nTarget.token = utils.database.connection.decryptValue(nTarget.token);
        if (nTarget.type === utils.vcs(project.vcs).pr_statusNotificationType) {
          if (utils.vcs(project.vcs).webhookHelpers.isPullRequest(eventType)) {
            supportedNotificationTargets.push(nTarget);
          }
        } else {
          supportedNotificationTargets.push(nTarget);
        }
      });
      return callback(err, target, supportedNotificationTargets);
    });
  }

  function getPipelineTasks(target, notificationTargets, callback) {
    project.getPipelineTasks((err, pipelineTasks) => {
      pipelineTasks = pipelineTasks || [];
      _.each(pipelineTasks, (task) => {
        if (task.metadata) {
          task.metadata = JSON.parse(task.metadata);
        }
      });

      return callback(err, target, notificationTargets, pipelineTasks);
    });
  }

  function getApplicationDockerContainer(target, notificationTargets, postDeployActions, callback) {
    project.getApplicationImage({
      autoFetch: true,
      autoFetchLimit: 3
    }, (err, applicationImage) => {
      if (applicationImage) {
        applicationImage.tags = []
        if (eventType === 'pull_request' || eventType === 'close_pull_request') {
          // When we build an application image for a Pull request, we
          // generate the tag name and don't push the temporary image to
          // the 'production' tag specified in the image_tag property of the image.
          applicationImage.tags.push(getAppName(eventType, commit));
        } else {
          // When a customer registers a docker image with a project, we build & push the docker container
          // to the tag specified by the customer in the docker image row. This means that if a customer
          // wants us to push the built container to latest, we will always push to that tag on the repo in DockerHub.
          // For a given build, we will push two images to DockerHub.
          // 1. Image tagged with the commitsha of the git commit that is used to kick off a build.
          applicationImage.tags.push(commit.commitSha)

          // 2. Specified By the user.
          if (applicationImage.image_tag) {
            applicationImage.tags.push(applicationImage.image_tag);
          } else {
            applicationImage.tags.push('latest');
          }
        }
      }
      return callback(err, target, notificationTargets, postDeployActions, applicationImage);
    });
  }

  function getBuildContainer(target, notificationTargets, postDeployActions, applicationImage, callback) {
    project.getBuildContainer({
      autoFetch: true,
      autoFetchLimit: 4
    }, (err, buildContainer) => {
      if (!err && !buildContainer) {
        logger.warn('ORM returned no error and no build container. wat.');
      }

      return callback(err, target, notificationTargets, postDeployActions, applicationImage, buildContainer);
    });
  }

  function createExecutionRow(target, notificationTargets, postDeployActions, applicationImage, buildContainer, callback) {
    var newExecution = {
      name: commit.title,
      message: commit.message,
      result: 'in-progress',
      project_id: project.id,
      reason_type: eventType,
      reason_commitSha: commit.commitSha,
      reason_commitUrl: commit.commitUrl,
      reason_compareUrl: commit.compareUrl,
      reason_author: commit.author,
      reason_author_avatarUrl: commit.avatarUrl,
      reason_createdDate: new Date().toISOString(),
      concourse_pipeline_id: uuid.v1()
    };
    connection.models.build.create(newExecution, (err, execution) => {
      if (err || !execution) {
        err = err || new Error('ORM returned no error and no execution object for build.create');
      }

      return callback(err, target, notificationTargets, postDeployActions, execution, applicationImage, buildContainer);
    });
  }

  function loadSystemImages(target, notificationTargets, postDeployActions, execution, applicationImage, buildContainer, callback) {
    utils.systemImages.loadImages((loadError) => {
      return callback(loadError, target, notificationTargets, postDeployActions, execution, applicationImage, buildContainer);
    });
  }

  function getPipelineTemplateFile(target, notificationTargets, postDeployActions, execution, applicationImage, buildContainer, callback) {
    generatePipelineTemplateFile(
      eventType,
      project,
      commit,
      target,
      notificationTargets,
      postDeployActions,
      execution,
      applicationImage,
      buildContainer,
      logger,
      (err, pipelineFilePath, pipelineInputs) => {
        return callback(err, target, notificationTargets, postDeployActions, execution, pipelineFilePath, pipelineInputs);
      });
  }

  function startConcourseExecution(target, notificationTargets, postDeployActions, execution, pipelineFilePath, pipelineInputs, callback) {
    return utils.concourse.client(logger).startPipeline(
      execution.concourse_pipeline_id,
      pipelineFilePath,
      pipelineInputs,
      (err) => {
        execution.result = err ? 'Build Failed' : 'Enqueued Build';

        fs.unlink(pipelineFilePath, (unlinkErr) => {
          if (unlinkErr) {
            logger.warn(`Unable to unlink pipeline file: ${pipelineFilePath}`);
          }
          return callback(err, execution);
        });
      });
  }

  function updateExecutionRow(execution, callback) {
    execution.save((err) => {
      return callback(err, execution);
    });
  }
};

function generatePipelineTemplateFile(eventType, project, commit, target, notificationTargets, postDeployActions, execution, applicationImage, buildContainer, logger, done) {
  var fileMappings = {
      pull_request: 'foo_pull_request_pipeline.yml',
      close_pull_request: 'foo_close_pull_request_pipeline.yml',
      build_repo_HEAD: 'foo_build_repo_HEAD.yml',
      push: 'foo_build_repo_HEAD.yml',
      manual: 'foo_build_repo_HEAD.yml'
    },
    pipelineInputs = null,
    pipelineFilePath = `ignore_pipeline_${execution.concourse_pipeline_id}.yml`;

  return async.waterfall([
    generatePipeline,
    savePipelineFile
  ], onComplete);

  function generatePipeline(callback) {
    var pipeline;

    try {
      var appName = getAppName(eventType, commit),
        options = {
          build: execution,
          project: project,
          targets: [target],
          deploymentTarget: target,
          notificationTargets: notificationTargets,
          commit: commit,
          appName: appName,
          applicationImage: applicationImage,
          buildContainer: buildContainer,
          postDeployActions: postDeployActions
        };
      logger.info('Unable to find a pipeline file in user commit, running in-built pipeline.');

      pipeline = utils.concourse
        .getPipelineBuilder(eventType)
        .buildPipeline(options);

      return callback(null, pipeline, 'utf8');
    } catch (err) {
      return callback(err);
    }
  }

  function savePipelineFile(pipelineContents, encoding, callback) {
    fs.writeFile(pipelineFilePath, pipelineContents, encoding, callback);
  }

  function onComplete(err) {
    if (err) {
      logger.error('Unable to get pipeline, something very wrong happened.', err);
    }

    return done(err, pipelineFilePath, pipelineInputs);
  }
}

function getAppName(eventType, commit) {
  // Temporary deploys use generated appNames, official deploys use the value from the manifest
  var appName = '';
  if (eventType === 'pull_request' || eventType === 'close_pull_request') {
    // The appname is of the format : Repo/NamePRBRANCH30
    var uniqueName = commit.base.repo.full_name + commit.repo_branch + commit.number;

    // Return the hashed hex representation of the appName since we need it to be URL safe
    appName = crypto.createHash('sha1').update(uniqueName).digest('hex');
  }

  return appName;
}
