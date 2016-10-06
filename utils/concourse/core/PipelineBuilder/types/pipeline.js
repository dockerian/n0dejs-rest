var Resource = require('./resource'),
  ResourceType = require('./resource_type'),
  Job = require('./job'),
  jsonyaml = require('json2yaml');

function Pipeline() {
  this.resource_types = [];
  this.resources = [];
  this.jobs = [];
}

Pipeline.prototype.Resource = function (resource) {
  this.resources.push(resource);
  return this;
};

Pipeline.prototype.ResourceType = function (resourceType) {
  this.resource_types.push(resourceType);
  return this;
};

Pipeline.prototype.Job = function (job) {
  this.jobs.push(job);
  return this;
};

Pipeline.prototype.getYaml = function () {
  return jsonyaml.stringify(this);
};

module.exports = Pipeline;
