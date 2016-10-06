var _ = require('lodash'),
  fs = require('fs'),
  orm = require('orm'),
  async = require('async'),
  database = require('../../database'),
  encryption = require('./encryption.js'),
  utils = require('../');

var _connection;

module.exports = function connection(callback) {
  if (isConnected()) {
    return callback(null, _connection);
  }
  return async.series([
    connect,
    setupModels,
    setupAssociations,
    setupEncryption
  ], (err) => {
    return callback(err, _connection);
  });
};

function isConnected() {
  return _connection &&
    _connection.driver &&
    _connection.driver.db &&
    _connection.driver.db.state === 'authenticated';
}

function connect(callback) {
  utils.settings.database.pool = true;

  orm.connect(utils.settings.database, (err, con) => {
    if (err) {
      return callback(err);
    }

    _connection = con;
    _connection.settings.set('instance.cache', false);
    _connection.settings.set('instance.returnAllErrors', true);
    _connection.settings.set('instance.cascadeRemove', false);

    return callback();
  });
}

function setupModels(callback) {
  _.each(database.models, (model) => {
    model(_connection);
  });

  return callback();
}

function setupAssociations(callback) {
  _connection.models.deployment.hasOne('build', _connection.models.build, {
    required: true,
    reverse: 'Deployment',
    autoFetch: false
  });

  _connection.models.project.hasOne('deploymentTarget', _connection.models.deploymentTarget, {
    required: false,
    field: 'deployment_target_id',
    reverse: 'projects',
    autoFetch: true
  });

  _connection.models.deploymentTarget.hasOne('user', _connection.models.user, {
    required: true,
    reverse: 'targets',
    field: 'user_id',
    autoFetch: false
  });

  _connection.models.project.hasOne('applicationImage', _connection.models.image, {
    required: false,
    reverse: false,
    autoFetch: true,
    field: 'application_image_id',
    autoFetchLimit: 3
  });

  _connection.models.project.hasOne('buildContainer', _connection.models.build_container, {
    required: true,
    reverse: false,
    autoFetch: true,
    field: 'build_container_id',
    autoFetchLimit: 3
  });

  _connection.models.build_container.hasOne('image', _connection.models.image, {
    required: true,
    autoFetch: true,
    autoFetchLimit: 3,
    field: 'build_container_image_id'
  });

  _connection.models.project.hasOne('user', _connection.models.user, {
    required: true,
    reverse: 'projects',
    field: 'user_id',
    autoFetch: false
  });

  _connection.models.project.hasMany('members', _connection.models.user, {}, {
    mergeTable: 'project_member',
    mergeId: 'project_id',
    mergeAssocId: 'user_id',
    reverse: 'memberships',
    key: true
  });

  _connection.models.credential.hasOne('credential_type', _connection.models.credential_type, {
    required: true,
    field: 'credential_type_id',
    autoFetch: true
  });

  _connection.models.image.hasOne('credential', _connection.models.credential, {
    required: false,
    field: 'credential_id',
    autoFetch: true
  });

  _connection.models.image.hasOne('image_registry', _connection.models.image_registry, {
    required: true,
    field: 'image_registry_id',
    autoFetch: true
  });

  _connection.models.project.hasOne('build_container', _connection.models.build_container, {
    required: false,
    field: 'build_container_id',
    reverse: 'projects',
    autoFetch: false
  });

  _connection.models.project.hasOne('vcs', _connection.models.vcs, {
    required: true,
    field: 'vcs_id',
    reverse: false
  });

  _connection.models.project.hasOne('credential', _connection.models.credential, {
    required: false,
    field: 'credential_id',
    reverse: 'projects'
  });

  _connection.models.vcs.hasOne('credential', _connection.models.credential, {
    required: false,
    field: 'credential_id',
    reverse: 'vcses'
  });

  _connection.models.vcs.hasOne('vcs_type', _connection.models.vcs_type, {
    required: true,
    field: 'vcs_type_id',
    autoFetch: true
  });

  return callback();
}

function setupEncryption(callback) {
  encryptionClosure();
  _.each(_connection.models, setEncryptionHooks);
  return callback();

  function setEncryptionHooks(model, modelName) {
    var encryptedFields = _.map(_.filter(model.allProperties, 'encrypted'), 'name');

    if (encryptedFields.length === 0) {
      return;
    }

    utils.logger.debug(`Enabling encryption on ${modelName}, fields [${encryptedFields}]`);
    model.beforeSave(function (next) {
      encryptModel(this, 'beforeSave');
      next();
    });

    model.afterLoad(function () {
      decryptModel(this, 'afterLoad');
    });

    model.afterSave(function (success) {
      if (success) {
        decryptModel(this, 'afterSave');
      }
    });

    function decryptModel(model, reason) {
      _.each(encryptedFields, function decryptField(fieldName) {
        if (model[fieldName]) {
          utils.logger.debug(`${reason}: decrypting field ${modelName}.${fieldName}`);
          model[fieldName] = module.exports.decryptValue(model[fieldName]);
        }
      });
    }

    function encryptModel(model, reason) {
      _.each(encryptedFields, function encryptField(fieldName) {
        utils.logger.debug(`${reason}: encrypting field ${modelName}.${fieldName}`);
        model[fieldName] = module.exports.encryptValue(model[fieldName]);
      });
    }
  }

  // The key is only ever read and stored within this closure.
  // The key is only read once. It is not directly accessible in code.
  function encryptionClosure() {
    var key = fs.readFileSync(utils.settings.database.encryptionKeyFile, 'utf8'),
      encryptionInstance = encryption(key);

    // Module.exports these so values can be encrypted without needing key access.
    // eg. require('utils').database.connection.encryptValue(value);
    module.exports.encryptValue = function (value) {
      return encryptionInstance.encrypt.call(encryptionInstance, value);
    };

    module.exports.decryptValue = function (value) {
      return encryptionInstance.decrypt.call(encryptionInstance, value);
    };
  }
}
