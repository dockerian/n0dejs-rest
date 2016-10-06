var _ = require('lodash'),
  async = require('async'),
  orm = require('orm'),
  uuid = require('uuid'),
  httpStatus = require('http-status-codes'),
  utils = require('../../../utils');

exports.createProject = function createProject(req, res, next) {
  var userId = req.user.user_id,
    params = _.pick(req.body, 'name', 'type', 'deployment_target_id', 'token', 'repo', 'vcs_id', 'branchRefName', 'join_code', 'application_image_id', 'build_container_id'),
    repoSecretClearText = uuid.v4(),
    repoSecretEncrypted = utils.database.connection.encryptValue(repoSecretClearText),
    createdProject = undefined,
    newProject = {
      application_image_id: params.application_image_id,
      build_container_id: params.build_container_id,
      name: params.name,
      user_id: userId,
      joinCode: params.join_code,
      token: params.token,
      repo_owner: params.repo.owner,
      repo_name: params.repo.name,
      vcs_id: params.vcs_id,
      repo_sshUrl: params.repo.ssh_url,
      repo_branch: params.branchRefName,
      repo_httpUrl: params.repo.http_url,
      repo_cloneUrl: params.repo.clone_url,
      repo_webhookurl: params.repo.webhook_url,
      repo_githubRepoId: params.repo.github_repo_id,
      repo_secret: repoSecretClearText,
      deployment_target_id: params.deployment_target_id
    };

  req.logger.debug(`Creating project: ${newProject.name}`);

  // TODO: Sweet mercy is this begging to be transactional (flacnut).
  return async.series([
    validateProject,
    saveProject,
    getVCS,
    createPRStatusNotifier,
    createWebhook,
    updateProject
  ], onCompleteOrError);

  function validateProject(callback) {
    utils.validators.project(newProject, callback);
  }

  function saveProject(callback) {
    req.db.models.project.create(newProject, (err, savedProject) => {
      if (!savedProject) {
        err = err || new Error(`Unable to save project ${newProject.name}, no ORM error.`);
      } else {
        createdProject = savedProject;
      }

      return callback(err);
    });
  }

  function getVCS(callback) {
    req.logger.info("Getting VCS Instance for project");
    return attachVCSInstance(createdProject, (err, project) => {
      createdProject = project;
      return callback(err);
    });
  }

  function createPRStatusNotifier(callback) {
    var target = {
      name: 'PR-status-notifier',
      type: utils.vcs(createdProject.vcs).pr_statusNotificationType,
      location: 'https://api.dummyendpoint.org',
      token: utils.database.connection.encryptValue(createdProject.token),
      project_id: createdProject.id
    };

    req.logger.info("Creating PR status notification target");
    req.db.models.notificationtarget.create(target, (err) => {
      if (err) {
        req.logger.warn("Unable to create PR status notification target", err);
      }
      return callback();
    });
  }

  function createWebhook(callback) {
    createdProject.repo_webhookurl = utils.vcs(createdProject.vcs).webhookHelpers.getWebhookUrl(createdProject);
    utils.vcs(createdProject.vcs).client.addWebhook(
      createdProject,
      (err, webhook) => {
        if (err || !webhook) {
          err = err || new Error(`Unable to create web hook for project ${createdProject.name}.`);
        } else {
          req.logger.info("Created webhook");
          createdProject.repo_webHookId = webhook.id;
        }

        return callback(err);
      }
    );
  }

  function updateProject(callback) {
    // Update the project so that it is saved with the encrypted value for `repo_secret`
    createdProject.repo_secret = repoSecretEncrypted;
    createdProject.save(callback);
  }

  function onCompleteOrError(err) {
    if (err) {
      req.logger.debug(`Errors encountered during the creation of project ${newProject.name}`);
      return next(err);
    }

    req.logger.debug(`Created project ${createdProject.name} with id:${createdProject.id}`);
    return res.status(httpStatus.CREATED).send(createdProject);
  }
};

exports.deleteProject = function deleteProject(req, res, next) {
  var projectId = req.params.project_id;

  async.waterfall([
    getProject,
    attachVCSInstance,
    deleteWebhook,
    removeProject
    ], onCompleteOrError);

  function getProject(callback) {
    req.db.models.project.get(projectId, (err, project) => {
      if (!project) {
        err = err || new Error(`ORM returned no error, and no project:${projectId}`);
      }

      return callback(err, project);
    });
  }

  function deleteWebhook(project, callback) {
    if (!project.repo_webHookId) {
      return callback(null, project);
    }

    utils.vcs(project.vcs).client.deleteWebhook(
      project,
      (err) => {
        if (err && err.code === 404) {
          req.logger.debug(`Deleting Project with id ${projectId} that is missing webhook ${project.repo_webHookdId}`);
          return callback(null, project);
        }
        return callback(err, project);
      }
    );
  }

  // TODO: We should delete the CF Service binding if there is one.

  function removeProject(project, callback) {
    project.remove((err) => {
      return callback(err, project);
    });
  }

  function onCompleteOrError(err, project) {
    if (err) {
      req.logger.debug(`Removal for project with id '${projectId}' failed.`);
      return next(err);
    }
    req.logger.debug(`Deleted project ${project.name} with id:${project.id}`);
    return res.status(httpStatus.NO_CONTENT).send();
  }

};

exports.getProject = function getProject(req, res, next) {
  var projectId = req.params.project_id,
    userId = req.user.user_id;
  req.db.models.project.get(projectId, function withProject(err, project) {
    if (!project || err) {
      err = err || new Error(`ORM returned no error, and no project:${projectId}`);
      return next(err);
    }

    project.getMembers((members) => {
      var isOwner = project.user_id == userId;
      isMember = _.find(members, {
        'id': Number(userId)
      });

      if (!isMember && !isOwner) {
        var err = new Error(`Access denied to resource id:${projectId} for user id:${userId}`);
        err.status = 404;
        return next(err);
      }

      return res.send(project);
    });
  });
};

exports.getStatistics = function getStatistics(req, res, next) {
  var projectId = Number(req.params.project_id),
    results = [],
    states = [
      'Building',
      'Testing',
      'Deploying'
    ];

  return async.each(states, getLastSuccess, sendResults);

  function getLastSuccess(state, cb) {
    req.db.driver.execQuery(
      `select b.id, bs.endDate, b.message, b.reason_type as 'reason',
      b.reason_commitSha as 'sha', bs.type as 'type'  from build as b,
      build_step as bs  where bs.build_id=b.id and b.project_id=?
      and (bs.type=? and bs.state='succeeded')  and (reason_type='push'
      or reason_type='manual') order by b.reason_createdDate desc limit 1`, [projectId, state],
      function withQueryResults(err, data) {
        if (!data || err) {
          err = err || new Error('ORM return no data and no error for custom statistics query.');
          return cb(err);
        }

        if (data[0]) {
          results.push({
            state: state,
            build: data[0] || {}
          });
        }

        return cb();
      }
    );
  }

  function sendResults(err) {
    if (err) {
      return next(err);
    }

    res.send(results);
  }
};

exports.listProjects = function listProjects(req, res, next) {
  var userId = req.user.user_id;

  return async.parallel([
    getProjectsByOwner,
    getProjectsByMembership
  ], groupAndSendProjects);

  // Fetches the projects created by the provided user.
  // Callback expected: (err, projects[])
  function getProjectsByOwner(callback) {
    var filter = {
      'user_id': userId
    };

    req.db.models.project.find(filter, callback);
  }

  // Fetches the projects where the provided user is a collaborator.
  // Callback expected: (err, projects[])
  function getProjectsByMembership(callback) {
    req.db.models.user.get(userId, function withUser(err, user) {
      if (err || !user) {
        err = err || new Error(`ORM returned no error, and no user for id ${userId}`);
        req.logger.debug(`getProjectsByMembership: Unable to get projects for user: ${userId}`);
        return callback(err);
      }

      user.getMemberships(callback);
    });
  }

  // Combines the owned and member-of projects into one set to be returned.
  // Returns JSON or an error if either of the previous steps fail.
  // 'results' is an array of project[] arrays.
  function groupAndSendProjects(err, results) {
    if (err) {
      return next(err);
    }

    // combine the two lists in a de-duped fashion, where projects that the
    // user created take precedence.
    var projects = results[0] || [];
    _.each(results[1], function addMemberProject(project) {
      if (!_.find(projects, (p) => {
          return p.id === project.id;
        })) {
        projects.push(project);
      }
    });

    return res.send(projects);
  }
};

exports.updateProject = function updateProject(req, res, next) {
  var projectId = req.params.project_id,
    updatedValues = _.pick(req.body, 'name', 'type', 'deployment_target_id', 'token', 'repo', 'branchRefName', 'build_container_id', 'application_image_id', 'vcs_id');

  if (updatedValues.repo && updatedValues.repo.branch) {
    updatedValues.repo_branch = updatedValues.repo.branch;
  } else if (updatedValues.branchRefName) {
    updatedValues.repo_branch = updatedValues.branchRefName;
  }

  req.db.models.project.get(projectId, function withProject(err, project) {
    if (!project || err) {
      err = err || new Error(`ORM returned no error, and no project:${projectId}`);
      return next(err);
    }

    project.name = updatedValues.name;
    project.token = updatedValues.token || project.token;

    // Update the application container that this project points to.
    if (updatedValues.application_image_id) {
      project.application_image_id = updatedValues.application_image_id;
    }

    // Update the build container that this project points to.
    if (updatedValues.build_container_id) {
      project.build_container_id = updatedValues.build_container_id;
    }
    // Update the deployment target id for this project.
    if (updatedValues.deployment_target_id) {
      project.deployment_target_id = updatedValues.deployment_target_id;
    }

    if (updatedValues.vcs_id) {
      project.vcs_id = updatedValues.vcs_id;
    }

    if (updatedValues.repo_branch) {
      project.repo_branch = updatedValues.repo_branch;
    }

    return async.series([
      validateProject,
      saveProject
    ], onCompleteOrError);

    function validateProject(callback) {
      utils.validators.project(project, callback);
    }

    function saveProject(callback) {
      project.save(callback);
    }

    function onCompleteOrError(err) {
      if (err) {
        req.logger.debug(`Errors encountered during the update of project ${project.name}`);
        return next(err);
      }

      req.logger.debug(`Updated project ${project.name} with id:${project.id}`);
      return res.send(project);
    }
  });
};

function attachVCSInstance(project, callback) {
  project.getVcs({
    autoFetch: true,
    autoFetchLimit: 2
  }, (err, vcs) => {
    if (!vcs) {
      err = err || new Error(`Unable to retrieve vcs for project ${project.name}, no ORM error.`);
    } else {
      project.vcs = vcs;
    }

    return callback(err, project);
  });
}
