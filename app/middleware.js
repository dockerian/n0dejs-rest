var _ = require('lodash'),
  bodyParser = require('body-parser'),
  jwt = require('express-jwt'),
  morgan = require('morgan'),
  uuid = require('uuid'),
  jwtPerms = require('express-jwt-permissions'),
  utils = require('../utils');

exports.bodyParser = bodyParser.json();

exports.logger = morgan('dev', {
  stream: utils.logger.stream
});

exports.serviceInfo = function serviceInfo(req, res, next) {
  res.send({
    api_latest_version: 2,
    api_public_uri: utils.settings.crest.publicUri,
    auth_endpoint: utils.settings.auth.endpoint
  });
}

exports.errorHandler = function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    // log a warning and close the response
    req.logger.error('Next was called, but the response headers have been sent.', err);
    return res.end();
  }

  if (err.constructor.name === 'ORMError') {
    err.status = err.literalCode === 'NOT_FOUND' ? 404 : 500;
  }

  err.status = err.status || 500;
  if (err.status === 500) {
    // Only log this when we have an unexpected error.
    req.logger.error('Next was called with an error.', err);
  }

  utils.logger.getEntriesForId(req.id, (entries) => {
    res.status(err.status);
    res.json({
      message: err.message,
      details: err.details || '',
      status: err.status,
      api_version: 2,
      log: entries
    });

    return next();
  });
};

exports.requestId = function addRequestId(req, res, next) {
  req.id = uuid.v4();
  res.header('Request-ID', req.id);
  req.logger = utils.logger.shim(utils.logger, req.id);

  return next();
};

exports.database = function database(req, res, next) {
  // Establishes a new, or uses an existing connection.
  utils.database.connection((err, db) => {
    req.db = db;
    return next(err);
  });
};

exports.serializer = function serializer(req, res, next) {
  var send = res.send;
  res.send = function sendSerializer(contents) {
    if (contents instanceof Object && contents.serialize instanceof Function) {
      contents = contents.serialize();
    }

    if (contents instanceof Array) {
      _.each(contents, (v, i) => {
        if (v.serialize instanceof Function) {
          contents[i] = v.serialize();
        }
      });
    }

    return send.call(res, contents);
  };

  return next();
}

exports.jwtValidation = jwt({
  secret: utils.settings.auth.certificate || 'not provided'
});


/**
 * Restricts access so that only users with the specified scopes are authorized.
 * @param scope a string or array of scopes
 */
exports.restrictAccess = function (scope) {
  var checker = jwtPerms({
    permissionsProperty: 'scope'
  }).check(scope);
  return checker;
};

/**
 * systemAccess is middleware that only authorizes users with the 'n0dejsapi.system' scope.
 * This function delegates to {@link restrictAccess}.
 */
exports.systemAccess = exports.restrictAccess(['n0dejsapi.system']);



// TODO: this (exports.authorize) is more like an authenticate than an authorize?) Consider renaming?
exports.authorize = function authorize(req, res, next) {
  var jwtUser = req.user;
  jwtUser['user_name'] = jwtUser['user_name'] || "unknown";
  jwtUser['user_id'] = jwtUser['user_id'] || "unknown";
  // Get the user from the DB and set that on the request
  req.db.models.user.find({
    uaa_id: jwtUser.user_id
  }, (ignoredErr, ormUser) => {
    if (!ormUser || ormUser.length === 0) {
      // create User
      req.db.models.user.create({
        username: jwtUser['user_name'],
        uaa_id: jwtUser['user_id'],
        created: new Date().toISOString()
      }, (createErr, createdUser) => {
        if (createErr || !createdUser) {
          return next(createErr);
        }
        req.user = createdUser;
        req.user.scope = jwtUser.scope;
        next();
      });
    } else {
      // Replace the auth user on the request with the ormUser.
      // We shouldn't put any auth properties here, our inner code
      // shouldn't take a dependency on how we auth or the token contents.
      req.user = ormUser[0];
      req.user.scope = jwtUser.scope;
      next();
    }
  });
};
