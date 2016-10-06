var _ = require('lodash'),
  core = require('../core'),
  BuildRepoHeadPipeline = require('./build_repo_head.js'),
  PipelineBuilder = require('./pipelineBuilder.js'),
  PipelineRewriter = require('./pipelineRewriter.js'),
  utilities = require('./utilities.js'),
  utils = require('../../index.js');

function BuildPullRequestPipeline() {
  this.name = "build_pull_request";
  this.buildRepoHeadPipeline = new BuildRepoHeadPipeline();
}

BuildPullRequestPipeline.prototype.buildPipeline = function (options) {
  var self = this,
    builder = new core.PipelineBuilder(),
    pipeline = builder.Pipeline();

  pipeline = self.createBuildTestDeployPipeline(pipeline, options.project,
    options.build, options.commit,
    options.deploymentTarget,
    options.appName, options.applicationImage,
    options.buildContainer,
    options.build);

  // Rewrite the pipeline to add ensure tasks to every task in the build plan.
  new PipelineRewriter().rewritePipeline(pipeline, options.project, options.build, options.commit, options.notificationTargets, options.deploymentTarget);

  return pipeline.getYaml();
};

BuildPullRequestPipeline.prototype.createBuildTestDeployPipeline = function (pipeline, project, build, commit, deploymentTarget, appName, applicationImage, buildContainer, build) {
  var builder = new core.PipelineBuilder(),
    buildPlan = builder.Plan(),
    self = this;


  // Register the git repo we need to clonse as part of this build-pipeline.
  pipeline.Resource(utilities.cloneGitRepo(commit.base, 'upstream-git-repo', project));

  // If we need to build a Docker container from the Dockerfile in the root of the repo,
  // we register the docker image as a docker image resource in the Concourse Pipeline.
  // https://github.com/concourse/docker-image-resource
  if (applicationImage) {
    _.each(applicationImage.tags, (imageTag) => {
      applicationImage.image_tag = imageTag;
      pipeline.Resource(
        utilities.DockerImageResource(
          utilities.getDockerImageResourceName(project.name, imageTag),
          applicationImage)
      );
    })
  }

  // Clone the repo in the build Plan
  buildPlan.GetResource('upstream-git-repo');
  buildPlan.Task(utilities.mergePullRequest(commit, project));
  buildPlan = self.buildRepoHeadPipeline.createBuildTestDeployPlan(buildPlan, project,
    deploymentTarget, appName, applicationImage, buildContainer, build);

  pipeline.Job(
    builder
    .Job(utils.constants.Concourse.JobName, true, true)
    .Plan(buildPlan)
  );

  return pipeline;
};

module.exports = BuildPullRequestPipeline;
