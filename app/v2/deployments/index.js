var routes = module.exports = require('express').Router({
    mergeParams: true
  }),
  deploymentController = require('./controller.js'),
  utils = require('../../../utils');

routes.use('/targets', require('./targets'));

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'DeploymentController');
  return next();
});

routes.get('/:deployment_id', deploymentController.getDeployment);

routes.get('/', deploymentController.getDeploymentsForExecution);
routes.post('/', deploymentController.createDeployment);
