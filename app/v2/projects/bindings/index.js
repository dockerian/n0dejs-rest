var routes = module.exports = require('express').Router({
  mergeParams: true
});

routes.use('/cloudfoundry', require('./cloudfoundry'));
