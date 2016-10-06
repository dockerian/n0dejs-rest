function PipelineTask(name, config, privileged) {
  this.task = name;
  this.config = config;
  this.privileged = privileged;
}

PipelineTask.prototype.onSuccess = function (task) {
  this.on_success = task;
  return this;
};

PipelineTask.prototype.Ensure = function (task) {
  this.ensure = task;
  return this;
};

PipelineTask.prototype.onFailure = function (task) {
  this.on_failure = task;
  return this;
};

module.exports = PipelineTask;
