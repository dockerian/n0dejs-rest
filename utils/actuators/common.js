var async = require('async'),
  utils = require('../../utils'),
  actuators = require('./');

exports.processPRClosed = function processPRClosed(project, commit, logger, done) {
  logger = utils.logger.shim(logger, 'processPRClosed');
  logger.info("Closing Pull request");

  return async.waterfall([
    startDeleteCFAppExecution,
    getConnection,
    deleteDeploymentRecord
  ], onComplete);

  function startDeleteCFAppExecution(callback) {
    actuators.pipelines.startExecution('close_pull_request', project, commit, logger, callback);
  }

  function getConnection(execution, callback) {
    utils.database.connection(callback);
  }

  function deleteDeploymentRecord(connection, callback) {
    var findParams = {
      reason_pr_id: commit.number
    };

    connection.models.deployment
      .findByBuild(findParams)
      .remove(callback);
  }

  function onComplete(err) {
    if (err) {
      logger.debug(`Close PR flow completed with an error :`, err);
    } else {
      logger.debug(`Close PR flow completed successfully`);
    }

    return done(err);
  }
};
