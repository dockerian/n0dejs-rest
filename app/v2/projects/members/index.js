var routes = module.exports = require('express').Router({
    mergeParams: true
  }),
  membersController = require('./controller.js'),
  utils = require('../../../../utils');

routes.use((req, res, next) => {
  req.logger = utils.logger.shim(req.logger, 'ProjectMembersController');
  next();
});

routes.get('/:memberId', membersController.getMemberForProject);
routes.delete('/:memberId', membersController.removeMemberFromProject);

routes.post('/', membersController.addMemberToProject);
routes.get('/', membersController.listMembersForProject);
