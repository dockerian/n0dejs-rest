var routes = module.exports = require('express').Router({
    mergeParams: true
  }),
  cloudfoundryController = require('./controller.js'),
  utils = require('../../../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'CfBindingsController');
  next();
});

routes.post('/', cloudfoundryController.createBinding);
