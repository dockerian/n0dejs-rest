var _ = require('lodash'),
  async = require('async'),
  httpStatus = require('http-status-codes'),
  actuators = require('../../../../../utils/actuators'),
  utils = require('../../../../../utils');

exports.createBinding = function createBinding(req, res, next) {
  var projectId = req.params.project_id,
    cfAppId = req.body.cf_app_guid,
    executionId = req.body.execution_id;

  return getDeploymentTarget((deploymentTarget) => {
    actuators.cloudfoundry.createBinding(
      deploymentTarget,
      cfAppId,
      projectId,
      executionId,
      req.logger,
      sendResponse);
  });

  function getDeploymentTarget(callback) {
    req.logger.debug('Fetching deployment target.');

    req.db.models.project.get(projectId, (err, project) => {
      if (err || !project) {
        return next(err || new Error(`ORM returned no error and no project for: ${projectId}`));
      }

      project.getDeploymentTarget((err, target) => {
        if (err || !target) {
          return next(err || new Error(`ORM returned no error and no target for project: ${projectId}`));
        }

        return callback(target);
      });
    });
  }

  function sendResponse(err, serviceBindingResult) {
    if (err) {
      return next(err);
    }

    res.status(httpStatus.CREATED).send(serviceBindingResult);
  }
};
