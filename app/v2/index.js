var routes = module.exports = require('express').Router();

routes.use('/auth', require('./auth'));
routes.use('/artifacts', require('./artifacts'));
routes.use('/deployments', require('./deployments'));
routes.use('/hooks', require('./hooks'));
routes.use('/projects', require('./projects'));
routes.use('/users', require('./users'));
routes.use('/vcs', require('./vcs'));
