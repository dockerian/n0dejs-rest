var routes = module.exports = require('express').Router({
    mergeParams: true
  }),
  deploymentTargetsController = require('./controller.js'),
  utils = require('../../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'DeploymentTargetsController');
  return next();
});

routes.get('/:target_id', deploymentTargetsController.getTarget);
routes.delete('/:target_id', deploymentTargetsController.deleteTarget);
routes.put('/:target_id', deploymentTargetsController.updateTarget);

routes.post('/', deploymentTargetsController.createTarget);
routes.get('/', deploymentTargetsController.getTargets);
