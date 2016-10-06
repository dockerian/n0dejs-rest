var orm = require('orm'),
  httpStatus = require('http-status-codes'),
  utils = require('../../../../utils');

exports.addImage = function addImage(req, res, next) {
  req.db.models.image.create(req.body, (err, image) => {
    if (!image || err) {
      err = err || new Error('ORM returned no error, and no image');
      return next(err);
    }

    return res.status(httpStatus.CREATED).send(image);
  });
};

exports.getImage = function getImage(req, res, next) {
  var imageId = req.params.image_id;
  req.db.models.image.get(imageId, (err, image) => {
    if (!image || err) {
      err = err || new Error(`ORM returned no error, and no image:${imageId}`);
      return next(err);
    }

    return res.send(image);
  });
};

exports.getImages = function getImages(req, res, next) {
  req.db.models.image.all((err, images) => {
    if (!images || err) {
      err = err || new Error(`ORM returned no error, and no images`);
      return next(err);
    }

    return res.send(images);
  });
};

exports.removeImage = function removeImage(req, res, next) {
  var imageId = req.params.image_id;
  req.db.models.image.get(imageId, (err, image) => {
    if (!image || err) {
      err = err || new Error(`ORM returned no error, and no image:${imageId}`);
      return next(err);
    }

    image.remove((err) => {
      if (err) {
        req.logger.debug(`Removal for image with id '${image.image_id}' failed.`);
        return next(err);
      }

      return res.status(httpStatus.NO_CONTENT).send();
    });
  });
};

exports.updateImage = function updateImage(req, res, next) {
  var imageId = req.params.image_id;
  req.db.models.image.get(imageId, (err, image) => {
    if (!image || err) {
      err = err || new Error(`ORM returned no error, and no image:${imageId}`);
      return next(err);
    }

    // update the content with new values.
    image.image_registry_id = req.body.image_registry_id;
    image.image_repo = req.body.image_repo;
    image.image_tag = req.body.image_tag;
    image.image_label = req.body.image_label;
    image.registry_credential_id = req.body.registry_credential_id;

    image.save((err) => {
      if (err) {
        req.logger.debug(`Saving updates to image '${image.image_label}' with id '${image.image_id}' failed.`);
        return next(err);
      }

      return res.send(image);
    });
  });
};
