var _ = require('lodash'),
  async = require('async'),
  httpStatus = require('http-status-codes'),
  actuators = require('../../../utils/actuators'),
  utils = require('../../../utils');

/**
 * Create a deployment.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
exports.createDeployment = function createDeployment(req, res, next) {
  var buildId = req.body.build_id,
    params = _.pick(req.body, 'created_date', 'browse_url', 'build_id', 'application_guid'),
    newDeployment = {
      created_date: new Date().toISOString(),
      browseUrl: params.browse_url,
      build_id: params.build_id,
      active: 1
    };

  var build, deploymentTarget;
  var tasks = [
    getBuild,
    updateOldDeployments,
    createDeployment
  ];

  async.waterfall(tasks, (err, deployment) => {
    if (err) {
      return next(err);
    }


    // If we know the application this deployed as, lets
    // go ahead and make sure theres a CF binding for it,
    // and cleanup the other CF bindings at the same time.
    if (params.application_guid) {
      async.series([
        getDeploymentTarget,
        createServiceBinding,
        cleanupServiceBindings
      ], (err) => {
        if (err) {
          // We suppress these errors here, otherwise we may return
          // status 500 when we did infact create a deployment record.
          req.logger.warn('Error found working with CF bindings');
          req.logger.error(err);
        }

        res.status(httpStatus.CREATED).send(deployment);
      });
    } else {
      res.status(httpStatus.CREATED).send(deployment);
    }
  });

  function getBuild(callback) {
    req.db.models.build.get(buildId, (err, buildObj) => {
      build = buildObj;
      return callback(err);
    });
  }

  function updateOldDeployments(callback) {
    if (build.reason_type !== utils.constants.BuildReason.PullRequest) {
      req.db.driver.execQuery(
        `UPDATE deployment d
         INNER JOIN build b ON b.id = d.build_id
         SET active = 0
         WHERE b.reason_type != ? AND d.active = 1`, [
           utils.constants.BuildReason.PullRequest
         ],
        (err) => {
          return callback(err);
        });
    } else {
      callback()
    }
  }

  function createDeployment(callback) {
    req.db.models.deployment.create(newDeployment, (err, deployment) => {
      if (err || !deployment) {
        err = err || new Error(`ORM returned no error, ` +
          `and no deployment for build:${buildId}`);
      }
      return callback(err, deployment);
    });
  }

  function getDeploymentTarget(callback) {
    req.db.models.project.get(build.project_id, (err, project) => {
      if (err) {
        return callback(err);
      }

      project.getDeploymentTarget((err, target) => {
        deploymentTarget = target;
        return callback(err);
      })
    });
  }

  function createServiceBinding(callback) {
    actuators.cloudfoundry.createBinding(
      deploymentTarget,
      params.application_guid,
      build.project_id,
      build.id,
      req.logger,
      callback);
  }

  function cleanupServiceBindings(callback) {
    actuators.cloudfoundry.deleteUnboundServices(
      deploymentTarget,
      params.application_guid,
      req.logger,
      callback);
  }
};

/**
 * Get the deployment specified in the request.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
exports.getDeployment = function getDeployment(req, res, next) {
  var deploymentId = req.params.deployment_id;
  req.db.models.deployment.get(deploymentId, function withDeployment(err, deployment) {
    if (err || !deployment) {
      err = err || new Error(`ORM returned no error, and no deployment:${deploymentId}`);
      return next(err);
    }

    return res.send(deployment);
  });
};

/**
 * Get the deployments associated with the build specified in the request. If
 * there are no such deployments, return a <var>200/OK</var> and an empty JSON
 * array.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 */
exports.getDeploymentsForExecution = function getDeploymentsForExecution(req, res, next) {
  var findParams,
    buildId = req.query.build_id;

  if (!buildId) {
    var err = new Error('build_id filter is required but not provided in query.');
    err.status = httpStatus.BAD_REQUEST;
    return next(err);
  }

  req.db.models.deployment.find({
    "build_id": buildId
  }, (err, deployments) => {
    if (err) {
      return next(err);
    }

    return res.send(deployments);
  });
};
