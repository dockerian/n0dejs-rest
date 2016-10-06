var routes = module.exports = require('express').Router({
  mergeParams: true
});

routes.use('/credentials', require('./credentials'));
