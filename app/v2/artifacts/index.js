var routes = module.exports = require('express').Router(),
  utils = require('../../../utils'),
  artifactsController = require('./controller.js');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'artifactsController');
  next();
});

routes.get('/:artifact_id/download', artifactsController.downloadArtifact);

routes.get('/:artifact_id', artifactsController.getArtifact);
routes.delete('/:artifact_id', artifactsController.deleteArtifact);

routes.get('/', artifactsController.getArtifacts);
routes.post('/', artifactsController.uploadArtifact);
