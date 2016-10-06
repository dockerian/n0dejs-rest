var routes = module.exports = require('express').Router({
    mergeParams: true
  }),
  ownersController = require('./controller.js'),
  utils = require('../../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'ProjectOwnersController');
  next();
});

routes.get('/:ownerId', ownersController.getOwnerForProject);
routes.delete('/:ownerId', ownersController.removeOwnerFromProject);

routes.post('/', ownersController.addOwnerToProject);
routes.get('/', ownersController.listOwnersForProject);
