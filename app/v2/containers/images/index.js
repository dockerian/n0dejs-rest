var routes = module.exports = require('express').Router(),
  imagesController = require('./controller.js'),
  // middleware = require('../../../middleware.js'),  // uncomment to use restrictAccess below
  utils = require('../../../../utils');

routes.use('/registries', require('./registries'));

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'imagesController');
  next();
});

// Uncomment the following line to restrict access to these routes
// routes.use(middleware.systemAccess);

routes.get('/:image_id', imagesController.getImage);
routes.put('/:image_id', imagesController.updateImage);
routes.delete('/:image_id', imagesController.removeImage);

routes.get('/', imagesController.getImages);
routes.post('/', imagesController.addImage);
