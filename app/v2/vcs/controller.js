  var _ = require("lodash"),
    httpStatus = require('http-status-codes'),
    async = require('async'),
    utils = require('../../../utils');

  //TODO: Add this to applicationcontext object.
  var VCSTYPES = {
    GITHUB: 1,
    GITHUB_ENTERPRISE: 2,
    BITBUCKET: 3
  };

  exports.addVcs = function addVcs(req, res, next) {
    params = _.pick(req.body, 'vcs_type', 'browse_url', 'api_url', 'label', 'credential_id', 'skip_ssl_validation');
    if (!VCSTYPES[params.vcs_type]) {
      var err = new utils.errors.BadRequestError('Invalid vcs type provided');
      return next(err);
    }
    var vcs = {
      vcs_type_id: VCSTYPES[params.vcs_type],
      browse_url: params.browse_url,
      api_url: params.api_url,
      label: params.label,
      credential_id: params.credential_id,
      skip_ssl_validation: params.skip_ssl_validation
    };

    req.db.models.vcs.create(vcs, (err, vcs) => {
      if (!vcs || err) {
        err = err || new Error('ORM returned no error, and no vcs');
        return next(err);
      }

      vcs.vcs_type = _.invert(VCSTYPES)[vcs.vcs_type_id];
      return res.status(httpStatus.CREATED).send(vcs);
    });
  };

  exports.getVcs = function getVcs(req, res, next) {
    var vcsId = req.params.vcs_id;
    req.db.models.vcs.get(vcsId, (err, vcs) => {
      if (!vcs || err) {
        err = err || new Error(`ORM returned no error, and no vcs:${vcsId}`);
        return next(err);
      }

      vcs.vcs_type = _.invert(VCSTYPES)[vcs.vcs_type_id];
      return res.send(vcs);
    });
  };

  exports.getVcsAuth = function getVcs(req, res, next) {
    var vcsId = req.params.vcs_id;
    req.db.models.vcs.get(vcsId, {
      autoFetch: true,
      autoFetchLimit: 2
    }, (err, vcs) => {
      if (!vcs || err) {
        err = err || new Error(`ORM returned no error, and no vcs:${vcsId}`);
        return next(err);
      }

      if (!vcs.credential || vcs.credential.length === 0) {
        var noVCSAuthError = new Error("no credentials found on vcs instance");
        noVCSAuthError.status = httpStatus.NOT_FOUND;
        return next(noVCSAuthError);
      }

      var vcsCedential = vcs.credential;
      var credential = {};

      credential.serialize = function () {
        var credentialType = '';
        if (vcsCedential.credential_type) {
          if (vcsCedential.credential_type.credential_type) {
            credentialType = vcsCedential.credential_type.credential_type;
          } else {
            credentialType = vcsCedential.credential_type;
          }
        }

        return {
          credential_id: vcsCedential.credential_id,
          credential_type: credentialType,
          credential_key: vcsCedential.credential_key,
          credential_value: vcsCedential.credential_value,
          credential_extra: vcsCedential.credential_extra,
          created: vcsCedential.created,
          modified: vcsCedential.modified,
          label: vcsCedential.label,
          owner_id: vcsCedential.owner_id
        };
      };

      return res.send(credential);
    });
  };

  exports.getVcses = function getVcses(req, res, next) {
    req.db.models.vcs.all((err, vcss) => {
      if (!vcss || err) {
        err = err || new Error(`ORM returned no error, and no vcsses`);
        return next(err);
      }

      _.each(vcss, (vcs) => {
        vcs.vcs_type = _.invert(VCSTYPES)[vcs.vcs_type_id];
      });

      return res.send(vcss);
    });
  };

  exports.listVcsTypes = function listVcsTypes(req, res, next) {
    req.db.models.vcs_type.all((err, vcsTypes) => {
      if (!vcsTypes || err) {
        err = err || new Error(`ORM returned no error, and no vcs_types`);
        return next(err);
      }

      return res.send(vcsTypes);
    });
  };

  exports.removeVcs = function removeVcs(req, res, next) {
    var vcsId = req.params.vcs_id;
    async.waterfall([
      getIsVCSInUse,
      getVcsInstance,
      deleteVcsInstance
    ], (err) => {
      if (err) {
        return next(err);
      }

      return res.status(httpStatus.NO_CONTENT).send();
    });

    function getIsVCSInUse(callback) {
      req.db.models.project.count({
        vcs_id: vcsId
      }, (err, count) => {
        if (!err && count > 0) {
          err = new utils.errors.UnexpectedOrmError(`Cannot delete. ` +
            `The vcs is still in use by ${count} project(s).`);
        }

        return callback(err);
      });
    }

    function getVcsInstance(callback) {
      req.db.models.vcs.get(vcsId, (err, vcs) => {
        if (!vcs || err) {
          err = err || new Error(`ORM returned no error, and no vcs:${vcsId}`);
          return next(err);
        }

        return callback(err, vcs);
      });
    }

    function deleteVcsInstance(vcs, callback) {
      vcs.remove((err) => {
        if (err) {
          req.logger.error(`Removal for vcs '${vcs.label}' ` +
            `with id '${vcs.id}' failed.`);
        }

        return callback(err);
      });
    }
  };

  exports.updateVcs = function updateVcs(req, res, next) {
    var vcsId = req.params.vcs_id;
    req.db.models.vcs.get(vcsId, (err, vcs) => {
      if (!vcs || err) {
        err = err || new Error(`ORM returned no error, and no vcs:${vcsId}`);
        return next(err);
      }

      // update the content with new values.
      params = _.pick(req.body, 'vcs_type', 'browse_url', 'api_url', 'label', 'credential_id', 'skip_ssl_validation');
      vcs.vcs_type_id = VCSTYPES[params.vcs_type],
        vcs.browse_url = params.browse_url,
        vcs.api_url = params.api_url,
        vcs.label = params.label,
        vcs.credential_id = params.credential_id,
        vcs.skip_ssl_validation = params.skip_ssl_validation

      vcs.save((err) => {
        if (err) {
          req.logger.debug(`Saving updates to vcs '${vcs.label}' with id '${vcs.vcs_id}' failed.`);
          return next(err);
        }

        vcs.vcs_type = _.invert(VCSTYPES)[vcs.vcs_type_id];
        return res.send(vcs);
      });
    });
  };
