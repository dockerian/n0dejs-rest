var routes = module.exports = require('express').Router(),
  statusController = require('./controller.js'),
  utils = require('../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'SystemStatusController');
  next();
});

routes.get('/', statusController.getStatus);
