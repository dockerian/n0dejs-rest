var PipelineTask = require('./task'),
  GetResource = require('./get_resource'),
  Aggregate = require('./aggregate'),
  PutResource = require('./put_resource');

function BuildPlan() {
  this.plan = [];
  this.max_in_flight = 1;
}

BuildPlan.prototype.Task = function (task) {
  this.plan.push(task);
  return this;
};

BuildPlan.prototype.Aggregate = function (aggregate) {
  this.plan.push(aggregate);
  return this;
};

BuildPlan.prototype.GetResource = function (resourceName, passed, versionRef) {
  this.plan.push(new GetResource(resourceName, passed, versionRef));
  return this;
};

BuildPlan.prototype.PutResource = function (resourceName, params) {
  this.plan.push(new PutResource(resourceName, params));
  return this;
};


module.exports = BuildPlan;
