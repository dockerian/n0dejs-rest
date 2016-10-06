var orm = require('orm'),
  httpStatus = require('http-status-codes'),
  _ = require("lodash"),
  utils = require('../../../../utils'),
  async = require('async');

//TODO: Add this to applicationcontext object.
var credentialTypes = {
  USERNAME_PASSWORD: 1,
  OAUTH2_TOKEN: 2,
  AWS_ACCESS_KEY: 3,
  PKI: 4,
  CLIENT_ID_SECRET: 5
};

exports.forgetCredential = function forgetCredential(req, res, next) {
  var credentialId = req.params.credential_id;
  req.db.models.credential.get(credentialId, (err, credential) => {
    if (!credential || err) {
      err = err || new Error(`ORM returned no error, and no credential:${credentialId}`);
      return next(err);
    }

    return async.parallel([
     checkIfProjectsExist,
     checkIfVcsesExist
   ], CheckResultAndForgetCredential);

    // check to see if any projects are still using this credential.
    function checkIfProjectsExist(callback) {
      credential.getProjects(function withProjects(err, projects) {
        if (projects && projects.length !== 0) {
          err = err || new utils.errors.UnexpectedOrmError(`Cannot delete. ` +
            `The credential is still in use by ` +
            `${projects.length} project(s).`);
          return callback(err);
        }
        callback(err);
      })
    };

    // check to see if any vcs(s) are still using this credential.
    function checkIfVcsesExist(callback) {
      credential.getVcses(function withVcses(err, vcses) {
        if (vcses && vcses.length !== 0) {
          err = err || new utils.errors.UnexpectedOrmError(`Cannot delete. ` +
            `The credential is still in use by ` +
            `${vcses.length} vcs(es).`);
        }
        return callback(err);
      })
    };

    function CheckResultAndForgetCredential(err) {
      if (err) {
        return next(err);
      }
      credential.remove((err) => {
        if (err) {
          req.logger.error(`Removal for vcs '${credential.label}' ` +
            `with id '${credential.credential_id}' failed.`);
          return next(err);
        }

        return res.status(httpStatus.NO_CONTENT).send();
      });
    }

  })
};

exports.listCredentials = function listCredentials(req, res, next) {
  var userId = req.user.user_id,
    findParams = {
      "owner_id": userId
    };

  if (!userId) {
    var err = new Error('userId filter is required but not provided in query.');
    err.status = httpStatus.BAD_REQUEST;
    return next(err);
  }

  req.db.models.credential.find(findParams, function withCredentials(err, credentials) {
    if (!credentials || err) {
      err = err || new Error(`ORM returned no error, and no credentials`);
      return next(err);
    }

    _.each(credentials, (credential) => {
      credential.credential_type = _.invert(credentialTypes)[credential.credential_type_id];
    });

    return res.send(credentials);
  });
};

exports.storeCredential = function storeCredential(req, res, next) {
  params = _.pick(req.body, 'credential_type', 'credential_key', 'credential_value', 'credential_extra', 'label');
  if (!credentialTypes[params.credential_type]) {
    var err = new utils.errors.BadRequestError('Invalid credential type');
    return next(err);
  }

  now = new Date(Date.now());

  var credentialDetail = {
    credential_type_id: credentialTypes[params.credential_type],
    credential_key: params.credential_key,
    credential_value: params.credential_value,
    owner_id: req.user.user_id,
    label: params.label,
    credential_extra: params.credential_extra,
    created: now,
    modified: now
  };

  credentialDetail.credential_key = utils.database.connection.encryptValue(params.credential_key);
  credentialDetail.credential_value = utils.database.connection.encryptValue(params.credential_value);
  if (credentialDetail.credential_extra) {
    credentialDetail.credential_extra = utils.database.connection.encryptValue(params.credential_extra);
  }

  req.db.models.credential.create(credentialDetail, (err, credential) => {
    if (!credential || err) {
      err = err || new Error('ORM returned no error, and no credential');
      return next(err);
    }

    credential.credential_type = _.invert(credentialTypes)[credential.credential_type_id];
    return res.status(httpStatus.CREATED).send(credential);
  });
};

exports.updateCredential = function updateCredential(req, res, next) {
  var credentialId = req.params.credential_id;
  req.db.models.credential.get(credentialId, (err, credential) => {
    if (!credential || err) {
      err = err || new Error(`ORM returned no error, and no credential:${credentialId}`);
      return next(err);
    }

    params = _.pick(req.body, 'credential_key', 'credential_value', 'credential_extra', 'label');
    credential.credential_key = params.credential_key;
    credential.credential_value = params.credential_value;
    credential.credential_extra = params.credential_extra;
    credential.label = params.label;
    credential.modified = new Date(Date.now());

    credential.save((err) => {
      if (err) {
        req.logger.error(`Update for credential with id '${credential.credential_id}' failed.`);
        return next(err);
      }

      credential.credential_type = _.invert(credentialTypes)[credential.credential_type_id];
      return res.send(credential);
    });
  });
};
