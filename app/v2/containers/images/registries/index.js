var routes = module.exports = require('express').Router(),
  registriesController = require('./controller.js'),
  utils = require('../../../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'registriesController');
  next();
});

routes.get('/:registry_id', registriesController.getImageRegistry);
routes.put('/:registry_id', registriesController.updateImageRegistry);
routes.delete('/:registry_id', registriesController.removeImageRegistry);

routes.get('/', registriesController.getImageRegistries);
routes.post('/', registriesController.addImageRegistry);
