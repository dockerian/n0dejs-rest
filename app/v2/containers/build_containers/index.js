var routes = module.exports = require('express').Router(),
  buildContainerController = require('./controller.js'),
  utils = require('../../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'buildContainerController');
  next();
});

routes.get('/:container_id', buildContainerController.getBuildContainer);
routes.put('/:container_id', buildContainerController.updateBuildContainer);
routes.delete('/:container_id', buildContainerController.removeBuildContainer);

routes.get('/', buildContainerController.getBuildContainers);
routes.post('/', buildContainerController.addBuildContainer);
