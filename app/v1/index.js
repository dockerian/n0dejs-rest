var routes = module.exports = require('express').Router();

routes.use('/', (req, res, next) => {
  req.logger.debug('v1!');
  next(new Error('The REST API v1 has been deprecated.'));
});
