var types = require('./types');

function PipelineBuilder() {
  this.pipeline = {};
}

PipelineBuilder.prototype.Task = function (name, config) {
  return new types.PipelineTask(name, config);
}

PipelineBuilder.prototype.Plan = function () {
  return new types.BuildPlan();
}

PipelineBuilder.prototype.Aggregate = function () {
  return new types.Aggregate();
}

PipelineBuilder.prototype.Pipeline = function () {
  return new types.Pipeline();
};

PipelineBuilder.prototype.Job = function (name, isPublic, isSerial) {
  return new types.Job(name, isPublic, isSerial);
};

PipelineBuilder.prototype.PutResource = function (name, properties) {
  return new types.PutResource(name, properties);
};

PipelineBuilder.prototype.Resource = function (name, type, properties) {
  return new types.Resource(name, type, properties);
};

PipelineBuilder.prototype.ResourceType = function (name, type, properties) {
  return new types.ResourceType(name, type, properties);
};

module.exports = PipelineBuilder;
