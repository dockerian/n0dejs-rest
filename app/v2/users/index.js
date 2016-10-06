var routes = module.exports = require('express').Router(),
  usersController = require('./controller.js'),
  utils = require('../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'UsersController');
  next();
});

routes.get('/', usersController.getUser);
