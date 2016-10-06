var _ = require('lodash'),
  fs = require('fs'),
  async = require('async'),
  semver = require('semver'),
  shell = require('shelljs'),
  utils = require('../');

exports.generateKey = function generateKey(done) {
  var createCommand = `ssh-keygen -C "database encryption key" -t rsa -f ${utils.settings.database.encryptionKeyFile} -P ""`;

  // Key didn't exist, go ahead and create a new one
  shell.exec(createCommand, (code, output) => {
    if (code === 0) {
      utils.logger.info(`Created new key file ${utils.settings.database.encryptionKeyFile}`);
      return done();
    }

    utils.logger.info(output);
    utils.logger.error('Unexpected error creating key file.');
    return done(new Error('Key creation failed.'));
  });
}

exports.setupDatabase = function setupDatabase(existingVersion, requiredVersion, done) {
  async.waterfall([
    getSortedVersions,
    importSchemas
  ], (err) => {
    done(err);
  });

  function getSortedVersions(callback) {
    async.waterfall([
      getFilesList,
      sortFilesByVersion
    ], callback);

    function getFilesList(cb) {
      fs.readdir('./database/versions/', cb);
    }

    function sortFilesByVersion(files, cb) {
      // Sort the files by their semantic version.
      var sortedVersionScripts = _.map(files, (f) => {
        return f.replace('.sql', '');
      }).sort(semver.compare);

      // Only run the scripts that are sematically greater than the version currently installed,
      // and less than or equal to the version we require to be installed.
      sortedVersionScripts = _.filter(sortedVersionScripts, (version) => {
        return semver.gt(version, existingVersion) && semver.lte(version, requiredVersion);
      });

      // Did we find the version supported by CREST?
      if (sortedVersionScripts.length === 0 ||
        semver.neq(_.last(sortedVersionScripts), requiredVersion)) {
        return cb(new Error(`DB upgrade script for version [${requiredVersion}] required by rest-service was not found.`));
      }

      cb(null, sortedVersionScripts);
    }
  }

  function importSchemas(sortedVersionScripts, callback) {
    async.eachSeries(sortedVersionScripts, importSchemaVersion, callback);

    function importSchemaVersion(version, cb) {
      utils.logger.info('Importing schema version :', version);
      var dbVersion = version,
        usd = utils.settings.database,
        importSchema = `mysql -u ${usd.user} -p${usd.password} -h ${usd.host} < ./database/versions/${version}.sql`

      shell.exec(importSchema, function (code, output) {
        if (code === 0) {
          utils.logger.info('Schema version [', dbVersion, '] imported successfully');
          return cb();
        }

        utils.logger.info('Schema version [', dbVersion, '] import failed');
        return cb(new Error(`Schema version [${dbVersion}] import failed: ${output}`));
      });
    }
  }
}
