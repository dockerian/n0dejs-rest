var _ = require('lodash'),
  async = require('async'),
  orm = require('orm'),
  utils = require('./index.js');


exports.project = function validateProject(project, validationCallback) {
  var connection, invalidParams = [];

  return async.series([
    getDbConnection,
    fetchTargets,
    validateFieldsPopulated,
    validateUniqueName,
    validateUniqueRepoBranchTarget
  ], validationCallback);

  function getDbConnection(callback) {
    utils.database.connection((err, conn) => {
      connection = conn;
      return callback(err);
    });
  }

  function fetchTargets(callback) {
    if (!project.deployment_target_id) {
      return callback(new utils.errors.BadRequestError('target', 'A target object is required with a valid id.'));
    }

    connection.models.deploymentTarget.get(project.deployment_target_id, (err, target) => {
      if (err) {
        return callback(err);
      }

      if (!target || target.type !== 'cloudfoundry') {
        return callback(new utils.errors.BadRequestError('target', 'A valid target of type cloudfoundry was not found.'));
      }

      project.deploymentTarget = target;
      return callback();
    });
  }

  function validateFieldsPopulated(callback) {
    var err;

    // Verify fields are present and not empty.
    _.each(['name', 'build_container_id', 'repo_branch'], (field) => {
      if (!project[field]) {
        invalidParams.push(field);
      }
    });

    if (invalidParams.length > 0) {
      err = new utils.errors.BadRequestError(invalidParams);
    }

    return callback(err);
  }

  function validateUniqueName(callback) {
    // Project names must be unique per user.
    var findParams = {
      'user_id': project.user_id,
      'name': project.name
    };

    // If the id is set, then the project already exists, and we should
    // exclude it from the uniqueness query so it doesn't match against itself.
    if (project.hasOwnProperty('id')) {
      // orm.ne is a special helper function provided by the orm module to
      // test for "Not Equals"
      findParams.id = orm.ne(project.id);
    }

    connection.models.project.exists(findParams, (err, exists) => {
      if (err || exists) {
        err = err || new utils.errors.BadRequestError('name', `Project name '${project.name}' is already in use.`);
      }

      return callback(err);
    });
  }

  function validateUniqueRepoBranchTarget(callback) {
    // A user can only have one project with a given repo, branch, and
    // Cloud-Foundry target combination. This is to avoid the situation
    // whereby a checkin to VCS would result in multiple builds of the
    // same item being kicked off, which would result in multiple deploys
    // to the same ALS application endpoint.

    var findParams = {
      'user_id': project.user_id,
      'repo_httpUrl': project.repo_httpUrl,
      'repo_branch': project.repo_branch
    };

    // If the id is set, then the project already exists, and we should
    // exclude it from the uniqueness query so it doesn't match against itself.
    if (project.id && project.id > 0) {
      // orm.ne is a special helper function provided by the orm module to
      // test for "Not Equals"
      findParams.id = orm.ne(project.id);
    }

    project.deploymentTarget.getProjects().find(findParams, (err, rows) => {
      var existingProject,
        msg;

      if (rows && rows.length > 0) {
        existingProject = rows.pop();
        // If rows are returned, it means that there's already an existing
        // project that matches this new one.
        msg = `Branch '${project.repo_branch}' in repo '${project.repo_name}'
 is already targeted for deployment in this target by the '${existingProject.name }'
 project. Please select another target target.`;

        err = err || new utils.errors.BadRequestError('repo.branch', msg);
      }

      return callback(err);
    });
  }
}


exports.deploymentTarget = function validateDeploymentTarget(deploymentTarget, validationCallback) {
  var err, invalidParams = [];

  deploymentTarget.name = deploymentTarget.name ? deploymentTarget.name.trim() : '';
  deploymentTarget.organization = deploymentTarget.organization ? deploymentTarget.organization.trim() : '';
  deploymentTarget.space = deploymentTarget.space ? deploymentTarget.space.trim() : '';
  deploymentTarget.userName = deploymentTarget.userName ? deploymentTarget.userName.trim() : '';
  deploymentTarget.password = deploymentTarget.password ? deploymentTarget.password.trim() : '';

  _.each(['name', 'userName', 'password'], (field) => {
    if (!deploymentTarget[field]) {
      invalidParams.push(field);
    }
  });

  if (deploymentTarget.type === 'cloudfoundry') {
    if (!deploymentTarget.organization) {
      invalidParams.push('organization');
    }
    if (!deploymentTarget.space) {
      invalidParams.push('space');
    }
  }

  if (invalidParams.length > 0) {
    err = new utils.errors.BadRequestError(invalidParams);
  }

  return validationCallback(err);
}
