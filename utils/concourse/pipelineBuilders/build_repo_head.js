var _ = require('lodash'),
  core = require('../core'),
  PipelineBuilder = require('./pipelineBuilder.js'),
  PipelineRewriter = require('./pipelineRewriter.js'),
  utilities = require('./utilities.js'),
  utils = require('../../index.js');

function BuildRepoHeadPipeline() {
  this.name = "build_repo_head";
}

BuildRepoHeadPipeline.prototype.buildPipeline = function (options) {
  var self = this,
    builder = new core.PipelineBuilder(),
    pipeline = builder.Pipeline();
  pipeline = self.createBuildTestDeployPipeline(pipeline, options.project, options.build,
    options.commit, options.deploymentTarget, options.appName,
    options.applicationImage, options.buildContainer, options.postDeployActions);

  // Rewrite the pipeline to add ensure tasks to every task in the build plan.
  new PipelineRewriter().rewritePipeline(pipeline, options.project, options.build,
    options.commit, options.notificationTargets, options.deploymentTarget);
  return pipeline.getYaml();
};

BuildRepoHeadPipeline.prototype.createBuildTestDeployPipeline = function (pipeline, project, build, commit, deploymentTarget, appName, applicationImage, buildContainer, postDeployActions) {
  var builder = new core.PipelineBuilder(),
    buildPlan = builder.Plan(),
    self = this;

  // Clone the repo in the build Plan
  pipeline.Resource(utilities.cloneGitRepo(commit, 'n0dejs-git-repo', project));

  // Clone the repo in the build Plan
  buildPlan = buildPlan.GetResource('n0dejs-git-repo', '', commit.commitSha);
  buildPlan = self.createBuildTestDeployPlan(buildPlan, project, deploymentTarget, appName, applicationImage, buildContainer, build);
  buildPlan = self.addPostDeployActions(buildPlan, project, postDeployActions, deploymentTarget, appName);
  pipeline = self.addApplicationContainerResource(pipeline, project, applicationImage);

  pipeline.Job(
    builder
    .Job(utils.constants.Concourse.JobName, true, true)
    .Plan(buildPlan)
  );

  return pipeline;
};

BuildRepoHeadPipeline.prototype.addApplicationContainerResource = function (pipeline, project, applicationImage) {
  // If we need to build a Docker container from the Dockerfile in the root of the repo,
  // we register the docker image as a docker image resource in the Concourse Pipeline.
  // https://github.com/concourse/docker-image-resource
  if (applicationImage) {
    _.each(applicationImage.tags, (imageTag) => {
      applicationImage.image_tag = imageTag;
      applicationImage.cache = false;
      pipeline.Resource(
        utilities.DockerImageResource(
          utilities.getDockerImageResourceName(project.name, imageTag),
          applicationImage));
    });

  }
  return pipeline;
};

BuildRepoHeadPipeline.prototype.addPostDeployActions = function (buildPlan, project, pipelineTasks, deploymentTarget, appName) {
  pipelineTasks = pipelineTasks || [];
  _.each(pipelineTasks, function (pipelineTask) {
    switch (pipelineTask.task_type.toLowerCase()) {
      case "stormrunner":
        // If the project has a storm runner config as the post deploy action,
        // Add a task to run the storm runner tests.
        buildPlan.Task(utilities.runStormRunner(pipelineTask));
        break;
    }
  });

  return buildPlan;
};

BuildRepoHeadPipeline.prototype.createBuildTestDeployPlan = function (buildPlan, project, deploymentTarget, appName, applicationImage, projectBuildContainer, build) {
  var builder = new core.PipelineBuilder();

  buildPlan
    .Task(
      utilities.buildCode(projectBuildContainer.image)
    )
    .Task(
      utilities.testCode(projectBuildContainer.image)
    );

  // If we need to build a Docker container out of the customer's repo,
  // we will put to the Concourse docker image resource, which will
  // build & push a version of this container to the specified target DockerHub repository.
  // https://github.com/concourse/docker-image-resource#out-push-an-image-or-build-and-push-a-dockerfile
  if (applicationImage) {
    _.each(applicationImage.tags, (imageTag) => {
      applicationImage.image_tag = imageTag;
      buildPlan = utilities.buildApplicationImage(buildPlan,
        utilities.getDockerImageResourceName(project.name, imageTag),
        applicationImage,
        'build_code_output/app');
    });
  }

  buildPlan = buildPlan.Task(
    utilities.deployToCloudFoundry(project, deploymentTarget, appName, applicationImage, build, projectBuildContainer.retain_build_artifacts)
  );

  return buildPlan;
};

module.exports = BuildRepoHeadPipeline;
