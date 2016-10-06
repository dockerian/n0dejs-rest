var async = require('async'),
  utils = require('../../utils'),
  common = require('./common'),
  actuators = require('./');

exports.processPRClosed = common.processPRClosed;

exports.startExecution = function startExecution(eventType, project, commit, logger, done) {
  return async.series([
    setPRStatusPending,
    startExecution
  ], done);

  function setPRStatusPending(callback) {
    if (eventType === 'push') {
      return callback();
    }

    logger.info("Updating PR status");
    utils.vcs(project.vcs).client.updatePRStatus(
      project.token,
      project.repo_owner,
      project.repo_name,
      commit.commitSha,
      utils.constants.PullRequestStatus.Pending,
      utils.constants.PullRequestStatusDescription.StartingBuild,
      callback
    );
  }

  function startExecution(callback) {
    actuators.pipelines.startExecution(eventType, project, commit, logger, callback);
  }
};
