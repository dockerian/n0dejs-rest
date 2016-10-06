var _ = require('lodash'),
  async = require('async'),
  utils = require('../../../../utils'),
  httpStatus = require('http-status-codes');

/**
 * Create a new deployment target/target.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The callback function.
 * @return JSON object with status code 201/CREATED if succeeded;
 *         otherwise, Error object.
 */
exports.createTarget = function createTarget(req, res, next) {
  var createdDeploymentTarget = undefined,
    params = _.pick(req.body, 'name', 'url', 'userName', 'password',
      'organization', 'space', 'type', 'skip_ssl_validation');
  params.user_id = req.user.user_id;

  return async.series([
    validateTarget,
    saveTarget
  ], onCompleteOrError);

  function validateTarget(callback) {
    utils.validators.deploymentTarget(params, callback);
  }

  function saveTarget(callback) {
    params.userName = utils.database.connection.encryptValue(params.userName);
    params.password = utils.database.connection.encryptValue(params.password);
    params.url = utils.database.connection.encryptValue(params.url);

    return req.db.models.deploymentTarget.create(params, (err, deploymentTarget) => {
      if (err || !deploymentTarget) {
        err = err || new Error(`ORM returned no error, and no deploymentTarget.`);
      }

      createdDeploymentTarget = deploymentTarget;
      return callback(err);
    });
  }

  function onCompleteOrError(err) {
    if (err) {
      return next(err);
    }
    return res.status(httpStatus.CREATED).send(createdDeploymentTarget);
  }
};

/**
 * Delete the deployment target/target referenced in the request.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The callback function.
 */
exports.deleteTarget = function deleteTarget(req, res, next) {
  var targetId = req.params.target_id;

  req.db.models.deploymentTarget.get(targetId, function withTarget(err, target) {
    if (err || !target) {
      err = err || new Error(`ORM returned no error, and no target:${targetId}`);
      return next(err);
    }

    // check to see if any projects are still using this target.
    target.getProjects(function withProjects(err, projects) {
      if (err) {
        return next(err);
      }

      if (projects && projects.length !== 0) {
        var errorCannotDelete = new Error(`Cannot delete. ` +
          `The deployment target/target is still in use by ` +
          `${projects.length} project(s).`);
        return next(errorCannotDelete);
      } else {
        target.remove((err) => {
          if (err) {
            req.logger.error(`Removal for target '${target.name}' ` +
              `with id '${target.id}' failed.`);
            return next(err);
          }

          return res.status(httpStatus.NO_CONTENT).send();
        });
      }
    });
  });
};

/**
 * Get the target target/target specified in the request. If the
 * item is not found, return a <var>404/NOT_FOUND</var>.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The callback function.
 */
exports.getTarget = function getTarget(req, res, next) {
  var targetId = req.params.target_id;

  req.db.models.deploymentTarget.get(targetId, function withTarget(err, target) {
    if (err || !target) {
      err = err || new Error(`ORM returned no error, and no target:${targetId}`);
      return next(err);
    }

    return res.send(target);
  });
};

/**
 * Get the set of deployment targets/targets associated with the user
 * specified in the request. If there are no matching targets, return
 * a 200/OK and an empty set.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The callback function.
 * @return List of deployment targets, with status code 200/OK.
 */
exports.getTargets = function getTargets(req, res, next) {
  var userId = req.user.user_id,
    findParams = {
      "user_id": userId
    };

  req.db.models.deploymentTarget.find(findParams, function withTarget(err, targets) {
    if (err || !targets) {
      var err = err || new Error('ORM returned no error and no targets.');
      return next(err);
    }

    return res.send(targets);
  });
};

/**
 * Update the deployment target/target per the request params.
 *
 * @param {Object} req - The request object.
 * @param {Object} res - The response object.
 * @param {Function} next - The callback function.
 * @return JSON object of updated deployment target, or Error.
 */
exports.updateTarget = function updateTarget(req, res, next) {
  var targetId = req.params.target_id,
    updatedTarget = undefined,
    params = _.pick(req.body, 'name', 'url', 'userName', 'password',
      'organization', 'space', 'type', 'skip_ssl_validation');

  return async.series([
    validateTarget,
    updateDeploymentTarget
  ], onCompleteOrError);

  function validateTarget(callback) {
    utils.validators.deploymentTarget(params, callback);
  }

  function updateDeploymentTarget(callback) {
    req.db.models.deploymentTarget.get(targetId, function withTarget(err, target) {
      if (err || !target) {
        err = err || new Error(`ORM returned no error, and no deployment target:${targetId}`);
        callback(err);
      } else {
        target.name = params.name;
        target.userName = params.userName;
        target.url = params.url;
        target.password = params.password;
        target.organization = params.organization;
        target.space = params.space;

        target.save(function withTargetUpdate(saveError) {
          if (!saveError) {
            updatedTarget = target;
          }
          callback(saveError);
        });
      }
    });
  }

  function onCompleteOrError(err) {
    if (err) {
      return next(err);
    }
    return res.send(updatedTarget);
  }
};
