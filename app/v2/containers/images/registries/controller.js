var _ = require('lodash'),
  httpStatus = require('http-status-codes'),
  utils = require('../../../../../utils');

//TODO: Add this to applicationcontext object.
var imageTypes = {
  DOCKER: 1
};

exports.addImageRegistry = function addImageRegistry(req, res, next) {
  params = _.pick(req.body, 'registry_url', 'registry_label', 'skip_ssl_validation');

  var imageRegistry = {
    registry_url: params.registry_url,
    registry_label: params.registry_label,
    skip_ssl_validation: params.skip_ssl_validation
  };

  req.db.models.image_registry.create(imageRegistry, (err, registry) => {
    if (!registry || err) {
      err = err || new Error('ORM returned no error, and no image registry');
      return next(err);
    }

    return res.status(httpStatus.CREATED).send(registry);
  });
};

exports.getImageRegistry = function getImageRegistry(req, res, next) {
  var registryId = req.params.registry_id;
  req.db.models.image_registry.get(registryId, (err, registry) => {
    if (!registry || err) {
      err = err || new Error(`ORM returned no error, and no image registry:${registryId}`);
      return next(err);
    }

    return res.send(registry);
  });
};

exports.getImageRegistries = function getImageRegistries(req, res, next) {
  req.db.models.image_registry.all((err, registries) => {
    if (!registries || err) {
      err = err || new Error(`ORM returned no error, and no image registries`);
      return next(err);
    }

    return res.send(registries);
  });
};

exports.removeImageRegistry = function removeImageRegistry(req, res, next) {
  var registryId = req.params.registry_id;
  req.db.models.image_registry.get(registryId, (err, registry) => {
    if (!registry || err) {
      err = err || new Error(`ORM returned no error, and no image registry:${registryId}`);
      return next(err);
    }

    registry.remove((err) => {
      if (err) {
        req.logger.error(`Removal for image registry with id '${registry.image_registry_id}' failed.`);
        return next(err);
      }

      return res.status(httpStatus.NO_CONTENT).send();
    });
  });
};

exports.updateImageRegistry = function updateImageRegistry(req, res, next) {
  var registryId = req.params.registry_id,
    params = _.pick(req.body, 'registry_url', 'registry_label', 'skip_ssl_validation');

  req.db.models.image_registry.get(registryId, (err, registry) => {
    if (!registry || err) {
      err = err || new Error(`ORM returned no error, and no image registry:${registryId}`);
      return next(err);
    }

    // update the content with new values.
    registry.registry_url = params.registry_url;
    registry.registry_label = params.registry_label;
    registry.skip_ssl_validation = params.skip_ssl_validation;

    registry.save((err) => {
      if (err) {
        req.logger.debug(`Saving updates to image registry '${registry.registry_label}' with id '${registry.image_registry_id}' failed.`);
        return next(err);
      }

      return res.send(registry);
    });
  });
};
