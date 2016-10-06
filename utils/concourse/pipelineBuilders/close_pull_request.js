var core = require('../core'),
  utilities = require('./utilities'),
  utils = require('../../index.js');

function ClosePullRequestPipeline() {
  this.name = 'close_pull_request';
}

ClosePullRequestPipeline.prototype.buildPipeline = function (options) {
  var self = this,
    builder = new core.PipelineBuilder(),
    pipeline = builder.Pipeline();

  pipeline = self.createDeleteAppPipeline(pipeline, options.project, options.deploymentTarget, options.appName);
  return pipeline.getYaml();
};

ClosePullRequestPipeline.prototype.createDeleteAppPipeline = function (pipeline, project, deploymentTarget, appName) {
  var builder = new core.PipelineBuilder(),
    buildPlan = builder.Plan(),
    self = this,
    deleteAppTask;

  deleteAppTask = utilities.deleteApplication(project, deploymentTarget, appName);
  buildPlan.Task(deleteAppTask)

  pipeline.Job(
    builder
    .Job(utils.constants.Concourse.JobName, true, true)
    .Plan(buildPlan)
  );

  return pipeline;
};

module.exports = ClosePullRequestPipeline;
