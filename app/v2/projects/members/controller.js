var async = require('async'),
  httpStatus = require('http-status-codes'),
  _ = require('lodash');

exports.addMemberToProject = function addMemberToProject(req, res, next) {
  var projectId = req.params.project_id,
    userId = req.user.user_id;

  if (!userId || !projectId) {
    var err = new Error('Invalid parameters provided.');
    err.status = httpStatus.BAD_REQUEST;
    return next(err);
  }

  return async.waterfall([
    verifyProjectId,
    verifyNotAlreadyMember,
    addUserToMembers
  ], onAddMemberCompleteOrError);

  // Verifies that the user provided the right code to join the project
  // Calls the callback with the project they want to join or an error.
  // callback expected: (err, project)
  function verifyProjectId(callback) {
    req.db.models.project.find({
      'id': projectId
    }, function processGetProjectResult(err, projects) {

      if (!err && projects.length !== 1) {
        err = new Error('Invalid parameters provided.');
        err.status = httpStatus.BAD_REQUEST;
      }

      callback(err, projects[0]);
    });
  }

  // Verifies that the user is not already a member of the project.
  // callback expected: (err, project, user)
  function verifyNotAlreadyMember(project, callback) {
    req.db.models.user.get(userId, function withProject(err, user) {
      if (err) {
        return callback(err);
      }

      // quirk: hasMembers returns false if the member does exist greater than 1 times.
      project.hasMembers(user, function rejectIfMemberExists(err, memberExists) {
        if (!err && memberExists) {
          err = new Error('You\'re already a collaborator on this project.');
          err.status = httpStatus.BAD_REQUEST;
        }

        return callback(err, project, user);
      });
    });
  }

  // Adds a member to a project
  // callback expected: (err)
  function addUserToMembers(project, user, callback) {
    project.addMembers(user, callback);
  }

  function onAddMemberCompleteOrError(err) {
    if (err) {
      return next(err);
    }

    return res.status(httpStatus.CREATED).send();
  }
};

exports.getMemberForProject = function getMemberForProject(req, res, next) {
  return next(new Error('NOT IMPLEMENTED'));
};

exports.listMembersForProject = function listMembersForProject(req, res, next) {
  var projectId = req.params.projectId;
  req.db.models.project.get(projectId, function withProject(err, project) {
    if (!project || err) {
      err = err || new Error(`ORM returned no error, and no project:${projectId}`);
      return next(err);
    }

    project.getMembers(function withMembers(err, members) {
      if (err) {
        return next(err);
      }

      return res.send(members);
    });
  });
};

exports.removeMemberFromProject = function removeMemberFromProject(req, res, next) {
  return next(new Error('NOT IMPLEMENTED'));
};
