var routes = module.exports = require('express').Router({
  mergeParams: true
});

routes.use('/build_containers', require('./build_containers'));
routes.use('/images', require('./images'));
