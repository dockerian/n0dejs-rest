var orm = require('orm'),
  httpStatus = require('http-status-codes'),
  utils = require('../../../utils');

exports.getUser = function getUser(req, res, next) {
  // If no id was specified, just return the current user.
  var userId = req.user.user_id;

  req.db.models.user.get(userId, function withResult(err, user) {
    if (!user || err) {
      err = err || new Error(`ORM returned no error, and no user:${userId}`);
      return next(err);
    }

    return res.send(user);
  });
};

// TODO: THIS IS TEMPORARY - IT BELONGS IN THE /VCS/ PATH (flacnut - why?)
exports.getUserByUaaId = function getUserByUaaId(req, res, next) {
  req.db.models.user
    .find({
      'uaa_id': req.params.uaa_id
    })
    .limit(1)
    .all((err, users) => {
      if (err || !users) {
        err = err || new Error('ORM returned no error and an unexpected result.');
        return next(err);
      }

      if (users.length != 1) {
        err = new Error(`Cannot find user with uaa id ${req.params.uaa_id}.`);
        err.status = httpStatus.NOT_FOUND;
        return next(err);
      }

      res.send(users[0]);
    });
}
