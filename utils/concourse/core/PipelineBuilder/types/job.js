var BuildPlan = require('./plan');

function Job(name, isPublic, isSerial) {
  this.name = name;
  this.public = isPublic;
  this.serial = isSerial;
};

Job.prototype.Plan = function (buildPlan) {
  this.plan = buildPlan.plan;
  this.max_in_flight = buildPlan.max_in_flight;

  return this;
}

module.exports = Job;
