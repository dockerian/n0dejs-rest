var routes = module.exports = require('express').Router(),
  vcsController = require('./controller.js'),
  utils = require('../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'vcsController');
  next();
});

routes.get('/types', vcsController.listVcsTypes);

routes.delete('/:vcs_id', vcsController.removeVcs);
routes.get('/:vcs_id', vcsController.getVcs);
routes.get('/:vcs_id/auth', vcsController.getVcsAuth);
routes.put('/:vcs_id', vcsController.updateVcs);


routes.get('/', vcsController.getVcses);
routes.post('/', vcsController.addVcs);
