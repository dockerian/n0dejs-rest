var routes = module.exports = require('express').Router({
    mergeParams: true
  }),
  projectsController = require('./controller.js'),
  utils = require('../../../utils');

routes.use('/:project_id/members', require('./members'));
routes.use('/:project_id/owners', require('./owners'));
routes.use('/:project_id/bindings', require('./bindings'));

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'ProjectsController');
  next();
});

routes.get('/:project_id/statistics', projectsController.getStatistics);

routes.get('/:project_id', projectsController.getProject);
routes.put('/:project_id', projectsController.updateProject);
routes.delete('/:project_id', projectsController.deleteProject);

routes.get('/', projectsController.listProjects);
routes.post('/', projectsController.createProject);
