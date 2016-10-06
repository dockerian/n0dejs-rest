var routes = module.exports = require('express').Router(),
  credentialsController = require('./controller.js'),
  utils = require('../../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'credentialsController');
  next();
});

routes.delete('/:credential_id', credentialsController.forgetCredential);
routes.put('/:credential_id', credentialsController.updateCredential);

routes.post('/', credentialsController.storeCredential);
routes.get('/', credentialsController.listCredentials);
