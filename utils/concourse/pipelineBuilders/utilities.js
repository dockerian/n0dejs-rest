var core = require('../core'),
  utils = require('../../index.js'),
  util = require('util'),
  _ = require('lodash'),
  notifiers = require('./notifiers'),
  url = require('url');

function getNotifierResourceType(notificationTarget) {
  return notificationTarget.type + '_notifier_type_' + notificationTarget.id;
}

function getNotifierResourceName(notificationTarget) {
  return notificationTarget.type + '_notifier_' + notificationTarget.id;
}

function getDockerImageResourceName(projectName, tagName) {
  return `docker_image_resource_${projectName}_tag_${tagName}`;
}

function getDockerImageRepository(dockerImage) {
  var registryURL, repository;
  if (dockerImage.image_registry) {
    var registryURL = dockerImage.image_registry.registry_url.replace("https://", "").replace("http://", "");
    registryURL = registryURL.replace(/\/$/, "");
    return `${registryURL}/${dockerImage.repository || dockerImage.image_repo}`;
  }

  return dockerImage.repository || dockerImage.image_repo;
}

function getDockerParams(dockerImage) {
  var settings = utils.settings,
    params = {},
    credential = dockerImage.credential;

  params.repository = getDockerImageRepository(dockerImage);
  if (dockerImage.tag || dockerImage.image_tag) {
    params.tag = dockerImage.tag || dockerImage.image_tag;
  }

  if (settings.concourse.registryMirrorUrl && shouldCacheDockerImage(dockerImage, credential)) {
    params.registry_mirror = settings.concourse.registryMirrorUrl;
    params.insecure_registries = [
      settings.concourse.registryMirrorHostPort
    ];
  }
  if (credential) {
    params = _.extend(params, {
      'username': credential.username || credential.credential_key,
      'password': credential.password || credential.credential_value,
      'email': credential.email || credential.credential_extra
    });
  }

  return params;
}

function shouldCacheDockerImage(dockerImage, credential) {
  var registryURL = dockerImage.repository || dockerImage.image_repo;
  if (dockerImage.image_registry) {
    registryURL = dockerImage.image_registry.registry_url.replace("https://", "").replace("http://", "");
  }

  var segments = registryURL.split("/");

  //if the caching flag on the image is not set to false
  if (dockerImage.cache !== false) {
    //and if the url is pointing to DockerHub
    if (registryURL === "registry-1.docker.io" ||
      segments[0] === "registry-1.docker.io" ||
      //or the repo string does not point to a private registry (e.g. some.reg:5000/user/repo)
      (segments[0].indexOf(":") < 0 && segments[0].indexOf(".") < 0)) {
      //and the image is public (either no credential or no username given) or the username matches what has been given to the mirror
      if (!credential || !credential.username || credential.username === utils.settings.docker_username) {
        //Then we can cache the image, so return true
        return true;
      }
    }

    //otherwise we cannot cache the image, so return false
    return false;
  }
}

function DockerImageResource(name, dockerImage) {
  var builder = new core.PipelineBuilder(),
    settings = utils.settings,
    params = getDockerParams(dockerImage),
    resourceType = 'docker-image';

  return builder.Resource(name, resourceType, params);
}

function DockerImageResourceType(name, dockerImage) {
  var builder = new core.PipelineBuilder(),
    params = getDockerParams(dockerImage),
    settings = utils.settings,
    resourceType = 'docker-image';
  params.tag = params.tag || utils.settings.docker_image_tag;

  return builder.ResourceType(name, resourceType, params);
}

function getPublicStatusUri(buildId) {
  return `${utils.settings.crest.publicUri}/pipelines/execution/${buildId}`;
}

function buildCode(image) {
  var builder = new core.PipelineBuilder();

  return builder.Task(
    'Building', {
      'platform': 'linux',
      'foo_logfile': 'build_log.txt',
      'image_resource': DockerImageResourceType('ignored', image),
      inputs: [{
        name: 'n0dejs-git-repo',
        path: ''
      }],
      outputs: [{
        name: 'build_code_output',
        path: ''
      }],
      run: {
        'path': 'sh',
        'args': ['-c', utils.settings.taskCommands.build]
      }
    });
}

function testCode(image) {
  var builder = new core.PipelineBuilder();
  return builder.Task(
    'Testing', {
      'platform': 'linux',
      'foo_logfile': 'test_log.txt',
      'image_resource': DockerImageResourceType('ignored', image),
      inputs: [{
        name: 'build_code_output',
        path: ''
      }],
      outputs: [{
        name: 'test_code_output',
        path: ''
      }],
      run: {
        'path': 'sh',
        'args': ['-c', utils.settings.taskCommands.test]
      }
    }
  );
}

function cloudFoundryTask(taskName, script, logFileName, project, deploymentTarget, appPath, appName, inputs, applicationImage, build) {
  var builder = new core.PipelineBuilder(),
    params = {
      cf_target_api: deploymentTarget.url,
      cf_target_username: deploymentTarget.userName,
      cf_target_password: deploymentTarget.password,
      cf_target_organization: deploymentTarget.organization,
      cf_target_space: deploymentTarget.space,
      skip_ssl_validation: deploymentTarget.skip_ssl_validation,
      manifest: 'manifest.yml'
    };

  if (build) {
    params = _.extend(params, {
      cf_user_provided_service_name: util.format(utils.constants.System.UserProvidedServiceName, appName || project.name),
      foo_api_url: utils.settings.crest.publicUri,
      foo_pipeline_id: project.id,
      foo_execution_id: build.id
    });
  }
  if (applicationImage) {
    params.cf_docker_image = applicationImage.image_repo;
    if (applicationImage.image_tag) {
      params.cf_docker_image += ":" + applicationImage.image_tag;
    }
  }

  if (appPath && appPath.length > 0) {
    params.cf_application_path = appPath;
  }

  if (appName && appName.length > 0) {
    params.cf_application_name = appName;
  }

  return builder.Task(
    taskName, {
      'platform': 'linux',
      'foo_logfile': logFileName,
      'image_resource': DockerImageResourceType('ignored', utils.systemImages.images().workers.cloudFoundry),
      inputs: inputs,
      outputs: [{
        name: 'deploy_output'
      }],
      params: params,
      run: {
        'path': 'sh',
        'args': ['-c', script]
      }
    });
};

function deployToCloudFoundry(project, deploymentTarget, appName, applicationImage, build, deployBuiltArtifacts) {
  var applicationPath = 'app',
    inputName = 'n0dejs-git-repo';

  if (!!deployBuiltArtifacts) {
    applicationPath = 'app/app';
    inputName = 'build_code_output';
  }

  return cloudFoundryTask('Deploying', utils.settings.taskCommands.deploy,
    'deploy_log.txt', project, deploymentTarget, applicationPath, appName, [{
      name: inputName,
      path: 'app'
    }], applicationImage, build);
}

function deleteApplication(project, deploymentTarget, appName) {
  return cloudFoundryTask('Deleting-Temporary-Application', utils.settings.taskCommands.delete_app,
    'delete_app_log.txt', project, deploymentTarget, '', appName);
}

function registerNotifier(notificationTarget, dockerImages) {
  var builder = new core.PipelineBuilder();
  return DockerImageResourceType(
    getNotifierResourceType(notificationTarget),
    utils.systemImages.images().notifiers[notificationTarget.type]
  );
}

function createNotifier(notificationTarget, project, build, commit, statusUri) {
  var builder = new core.PipelineBuilder(),
    notifier = new(notifiers(notificationTarget.type.toLowerCase()))();

  return builder.Resource(getNotifierResourceName(notificationTarget),
    getNotifierResourceType(notificationTarget),
    notifier
    .getSourceProperties(notificationTarget, project, build, commit, statusUri)
  );
}

function cloneGitRepo(commit, repoName, project) {
  var builder = new core.PipelineBuilder();
  return builder.Resource(
    repoName || 'n0dejs-git-repo',
    'git', {
      uri: commit.clone_url,
      branch: commit.repo_branch,
      skip_ssl_verification: !!project.vcs.skip_ssl_validation
    }
  );
}

function mergePullRequest(pullRequest, project) {
  var builder = new core.PipelineBuilder();
  return builder.Task(
    'Merging-Pull-Request', {
      'platform': 'linux',
      'foo_logfile': 'merge_log.txt',
      'image_resource': DockerImageResourceType('ignored', utils.systemImages.images().workers.gitMerge),
      inputs: [{
        name: 'upstream-git-repo'
      }],
      outputs: [{
        name: 'n0dejs-git-repo'
      }],
      run: {
        'path': 'sh',
        'args': ['-c', utils.settings.taskCommands.gitMerge]
      },
      params: {
        source_directory: 'upstream-git-repo',
        output_directory: 'n0dejs-git-repo',
        pullrequest_repo_uri: pullRequest.clone_url,
        pullrequest_branch: pullRequest.repo_branch,
        skip_ssl_validation: !!project.vcs.skip_ssl_validation
      }
    }
  );
}

function createBuildEvent(buildId, eventName, input, eventLogFileName) {
  var builder = new core.PipelineBuilder(),
    params,
    inputs = [];
  params = {
    foobar_api_server_url: utils.settings.crest.privateUri,
    build_id: buildId,
    event_type: eventName,
    event_result: "succeeded",
    event_success_status: utils.constants.StepStatus.Success,
    event_failure_status: utils.constants.StepStatus.Failure,
    uaa_endpoint_url: utils.settings.auth.endpoint,
    service_account_client_id: utils.settings.serviceAccount.clientID,
    service_account_client_secret: utils.settings.serviceAccount.clientSecret
  };

  if (eventName === utils.constants.Status.Deploying) {
    params.application_url = `env://${input}/applicationurl`;
  }

  if (input && eventLogFileName) {
    inputs.push({
      name: input
    });
    params.event_exit_code = "env://" + input + "/exitcode";
    params.event_start_time = "env://" + input + "/starttime",
      params.event_end_time = "env://" + input + "/endtime"
    if (eventLogFileName) {
      params.event_log = input + "/" + eventLogFileName;
    }
  }

  return builder.Task(
    'create-build-event', {
      'platform': 'linux',
      'image_resource': DockerImageResourceType('ignored', utils.systemImages.images().notifiers.buildEvent),
      inputs: inputs,
      run: {
        'path': 'sh',
        'args': ['-c', '/scripts/notify']
      },
      params: params
    }
  );
}

function runStormRunner(stormRunnerTask) {
  var builder = new core.PipelineBuilder();
  var params = {};
  params.storm_runner_server_url = utils.constants.StormRunner.ServiceUrl;

  if (stormRunnerTask.credential) {
    params.storm_runner_user_name = stormRunnerTask.credential.credential_key;
    params.storm_runner_password = stormRunnerTask.credential.credential_value;
  }

  if (stormRunnerTask.metadata) {
    params.storm_runner_tenant_id = stormRunnerTask.metadata.storm_runner_tenant_id;
    params.storm_runner_project_id = stormRunnerTask.metadata.storm_runner_project_id;
    params.storm_runner_test_id = stormRunnerTask.metadata.storm_runner_test_id;
  }

  return builder.Task(
    'StormRunner Load Test', {
      'platform': 'linux',
      'foo_logfile': 'storm_runner_log.txt',
      'image_resource': DockerImageResourceType('ignored', utils.systemImages.images().workers.stormRunner),
      outputs: [{
        name: 'storm-runner-logs'
      }],
      run: {
        'path': 'sh',
        'args': ['-c', utils.settings.taskCommands.stormRunnerLoadTest]
      },
      params: params
    }
  );
}

function notify(buildStatus, notificationTarget, project, build, commit, statusUri) {
  var builder = new core.PipelineBuilder(),
    notifier = new(notifiers(notificationTarget.type.toLowerCase()))();

  return builder.PutResource(
    getNotifierResourceName(notificationTarget),
    notifier.getStatus(buildStatus, project, build, commit, statusUri)
  );
}

function buildApplicationImage(buildPlan, name, dockerImage, folder) {
  var builder = new core.PipelineBuilder(),
    params = {
      foo_docker_put: true,
      repository: dockerImage.image_repo,
      dockerfile: `${folder}/Dockerfile`,
      build: folder
    };

  buildPlan = buildPlan.PutResource(name, params);
  return buildPlan;
}

module.exports = {
  notify: notify,
  cloneGitRepo: cloneGitRepo,
  buildApplicationImage: buildApplicationImage,
  getDockerImageResourceName: getDockerImageResourceName,
  DockerImageResource: DockerImageResource,
  DockerImageResourceType: DockerImageResourceType,
  registerNotifier: registerNotifier,
  createNotifier: createNotifier,
  buildCode: buildCode,
  testCode: testCode,
  mergePullRequest: mergePullRequest,
  deployToCloudFoundry: deployToCloudFoundry,
  deleteApplication: deleteApplication,
  createBuildEvent: createBuildEvent,
  getPublicStatusUri: getPublicStatusUri,
  runStormRunner: runStormRunner
}
