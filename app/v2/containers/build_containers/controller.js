var orm = require('orm'),
  _ = require('lodash'),
  httpStatus = require('http-status-codes'),
  utils = require('../../../../utils');

exports.addBuildContainer = function addBuildContainer(req, res, next) {
  var newBuildContainer = _.pick(req.body, 'build_container_image_id', 'build_container_label', 'retain_build_artifacts');

  req.db.models.build_container.create(newBuildContainer, (err, buildContainer) => {
    if (!buildContainer || err) {
      err = err || new Error('ORM returned no error, and no build container');
      return next(err);
    }

    return res.status(httpStatus.CREATED).send(buildContainer);
  });
};

exports.getBuildContainer = function getBuildContainer(req, res, next) {
  var containerId = req.params.container_id;
  req.db.models.build_container.get(containerId, (err, buildContainer) => {
    if (!buildContainer || err) {
      err = err || new Error(`ORM returned no error, and no build container:${containerId}`);
      return next(err);
    }

    return res.send(buildContainer);
  });
};

exports.getBuildContainers = function getBuildContainers(req, res, next) {
  req.db.models.build_container.all((err, buildContainers) => {
    if (!buildContainers || err) {
      err = err || new Error(`ORM returned no error, and no build containers`);
      return next(err);
    }

    return res.send(buildContainers);
  });
};

exports.removeBuildContainer = function removeBuildContainer(req, res, next) {
  var containerId = req.params.container_id;
  req.db.models.build_container.get(containerId, (err, buildContainer) => {
    if (!buildContainer || err) {
      err = err || new Error(`ORM returned no error, and no build container:${containerId}`);
      return next(err);
    }

    // check to see if any projects are still using this build container.
    buildContainer.getProjects(function withProjects(err, projects) {
      if (err) {
        return next(err);
      }

      if (projects && projects.length !== 0) {
        var errorCannotDelete = new Error(`Cannot delete. ` +
          `The build container is still in use by ` +
          `${projects.length} project(s).`);
        return next(errorCannotDelete);
      } else {
        buildContainer.remove((err) => {
          if (err) {
            req.logger.error(`Removal for build container with id '${buildContainer.build_container_id}' failed.`);
            return next(err);
          }

          return res.status(httpStatus.NO_CONTENT).send();
        });
      }
    });
  });
};

exports.updateBuildContainer = function updateBuildContainer(req, res, next) {
  var containerId = req.params.container_id;
  req.db.models.build_container.get(containerId, (err, buildContainer) => {
    if (!buildContainer || err) {
      err = err || new Error(`ORM returned no error, and no build container:${containerId}`);
      return next(err);
    }

    // update the content with new values.
    buildContainer.build_container_image_id = req.body.build_container_image_id;
    buildContainer.build_container_label = req.body.build_container_label;
    buildContainer.retain_build_artifacts = req.body.retain_build_artifacts;

    buildContainer.save((err) => {
      if (err) {
        req.logger.debug(`Saving updates to build container '${buildContainer.build_container_label}' with id '${buildContainer.build_container_id}' failed.`);
        return next(err);
      }

      return res.send(buildContainer);
    });
  });
};
