var routes = module.exports = require('express').Router(),
  webhooksController = require('./controller.js'),
  utils = require('../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'WebhooksController');
  next();
});
