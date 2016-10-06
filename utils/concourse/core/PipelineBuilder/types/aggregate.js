var PipelineTask = require('./task'),
  GetResource = require('./get_resource'),
  PutResource = require('./put_resource');

function Aggregate() {
  this.aggregate = [];
}

Aggregate.prototype.Task = function (task) {
  this.aggregate.push(task);
  return this;
};

Aggregate.prototype.GetResource = function (resourceName, passed, versionRef) {
  this.aggregate.push(new GetResource(resourceName, passed, versionRef));
  return this;
};

Aggregate.prototype.PutResource = function (resourceName, params) {
  if (resourceName instanceof PutResource) {
    this.aggregate.push(resourceName);
  } else {
    this.aggregate.push(new PutResource(resourceName, params));
  }

  return this;
};


module.exports = Aggregate;
