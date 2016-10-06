var async = require('async'),
  utils = require('../../utils'),
  common = require('./common'),
  actuators = require('./');

exports.processPRClosed = common.processPRClosed;

exports.startExecution = function startExecution(eventType, project, commit, logger, done) {
  return async.series([
    refreshProjectToken,
    setPRStatusPending,
    startExecution
  ], done);

  function refreshProjectToken(callback) {
    utils.vcs(project.vcs).client.refreshProjectToken(project, (err, refreshedProject) => {
      project = refreshedProject;
      return callback(err);
    });
  }

  function setPRStatusPending(callback) {
    if (eventType === 'push') {
      return callback();
    }

    utils.vcs(project.vcs).client.updatePRStatus(
      project.token,
      project.repo_owner,
      project.repo_name,
      commit.commitSha,
      utils.constants.BitBucketPullRequestStatus.Pending,
      utils.constants.PullRequestStatusDescription.StartingBuild,
      callback
    );
  }

  function startExecution(callback) {
    actuators.pipelines.startExecution(eventType, project, commit, logger, callback);
  }
};
