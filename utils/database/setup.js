var q = require('q'),
  fs = require('fs'),
  _ = require('lodash'),
  shell = require('shelljs'),
  semver = require('semver'),
  packageJSON = require('../../package.json'),
  setupHelpers = require('./helpers.js'),
  async = require('async'),
  utils = require('../index.js');

module.exports.setup = function setup() {
  utils.logger.info(`Setting up database ...`);
  return bypass(arguments.callee.name)
    .then(createKeyIfNotExists)
    .then(generateSqlVariablesFile)
    .then(checkConnection)
    .then(getCurrentDbVersion)
    .then(checkDatabaseNeedsUpdate)
    .then(updateDatabase)
    .then(createCredential)
    .then(bypass);
};

module.exports.verify = function verify() {
  utils.logger.info(`Checking database ...`);
  return bypass(arguments.callee.name)
    .then(checkConnection)
    .then(getCurrentDbVersion)
    .then(checkDatabaseNeedsUpdate)
    .then(doUpdateIfNecessary)
    .then(bypass);
}

function bypass(tag) {
  return new Promise(
    function (resolve, reject) {
      utils.logger.warn(`Bypass setup` + (tag ? `: ${tag}` : "."))
      resolve()
    }
  )
}

function checkConnection() {
  return new Promise(
    function (resolve, reject) {
      var usd = utils.settings.database,
        checkConnectionCommand = `mysql -h"${usd.host}" -P"${usd.port}" -u"${usd.user}" -p"${usd.password}" -s -e "exit"`;

      shell.exec(checkConnectionCommand, {
        silent: true // true to hide error from mysql
      }, (code, output) => {
        if (code === 0) {
          utils.logger.info(`Mysql service available.`);
          resolve();
        } else {
          var err = new Error('Unable to establish database connection');
          utils.logger.error(`${err.message} - is mysql running?`);
          return reject(err);
        }
      });
    });
}

function checkDatabaseNeedsUpdate(existingVersion) {
  return new Promise(
    function (resolve, reject) {
      var requiredVersion = semver(packageJSON.config.database.version);
      if (semver.gt(existingVersion, requiredVersion)) {
        return reject(new Error(`Database version (${existingVersion}) is higher than the required version (${requiredVersion}).`));
      } else if (semver.eq(existingVersion, requiredVersion)) {
        return resolve([false, existingVersion]);
      } else {
        return resolve([true, existingVersion]);
      }
    });
}

function createCredential() {
  return new Promise(
    function (resolve, reject) {
      var done = (err) => {
        if (err) {
          utils.logger.error(err);
          return reject(err);
        }

        return resolve();
      };

      if (!(process.env.DOCKER_USERNAME && process.env.DOCKER_PASSWORD)) {
        // If no credentials are provided, resolve and return immediately
        // because this means that the images are available unauthenticated.
        return resolve();
      };

      async.waterfall([
        getConnection,
        getExistingCredentialRow,
        createNewCredentialRow,
        addCredentialToImages
      ], done);

      function getConnection(callback) {
        utils.database.connection((err, conn) => {
          return callback(err, conn);
        });
      }

      function getExistingCredentialRow(database, callback) {
        utils.logger.info(`Looking for existing system Image credentials`);
        database.models.credential.find({
          label: 'foo_system_image_credentials'
        }, (err, credentials) => {
          return callback(err, database, credentials);
        });
      }

      function createNewCredentialRow(database, credentials, callback) {
        if (credentials && credentials.length > 0) {
          utils.logger.info(`Found existing system Image credentials`);
          return callback(null, credentials[0]);
        }

        utils.logger.info(`Creating new system Image credentials`);
        database.models.credential.create({
          credential_type_id: 1,
          credential_key: process.env.DOCKER_USERNAME,
          credential_value: process.env.DOCKER_PASSWORD,
          credential_extra: process.env.DOCKER_EMAIL,
          label: 'foo_system_image_credentials'
        }, (createError, newCredential) => {
          return callback(createError, newCredential)
        });
      }

      function addCredentialToImages(systemCredentials, callback) {
        var usd = utils.settings.database,
          updateStatement = `UPDATE image set credential_id = '${systemCredentials.credential_id}' where image_label like 'foo_%'`,
          updateImageCommand = `mysql -h"${usd.host}" -P"${usd.port}" -D"${usd.database}" -u"${usd.user}" -p"${usd.password}" -s -e "${updateStatement}"`;
        shell.exec(updateImageCommand, {
          silent: true
        }, function (code, output) {
          if (code === 0) {
            utils.logger.info(`Images are successfully updated with credential_id: ${systemCredentials.credential_id}.`);
            return callback();
          } else {
            var err = new Error(`Failed to update images with credential_id.`);
            utils.logger.error(err.message);
            return callback(err);
          }
        });
      }

    });
}

function createKeyIfNotExists() {
  return new Promise(
    function (resolve, reject) {
      fs.lstat(utils.settings.database.encryptionKeyFile, withFileOrError);

      function withFileOrError(err, stats) {
        if (err && err.code !== 'ENOENT') {
          // Error checking if file exists
          utils.logger.error(``);
          return reject(err);
        }

        if (stats) {
          utils.logger.info(`Existing key found ${utils.settings.database.encryptionKeyFile}, created on ${stats.birthtime}`);
          return resolve();
        }

        setupHelpers.generateKey((err) => {
          if (err) {
            return reject(err);
          }

          return resolve();
        });
      }
    });
}

function doUpdateIfNecessary(result) {
  return new Promise(
    function (resolve, reject) {
      var requiredVersion = semver(packageJSON.config.database.version),
        requiresUpdate = result[0];

      if (!requiresUpdate) {
        utils.logger.info(`Database up to required version ${requiredVersion}`);
        return resolve();
      } else {
        var err = new Error(`Database must be updated to ${requiredVersion}`);
        return reject(err);
      }
    });
}

function generateSqlVariablesFile() {
  return new Promise(
    function (resolve, reject) {
      var tagNames = [
        "IMAGE_TAG_PYTHON_BUILD_CONTAINER",
        "IMAGE_TAG_NODEJS_BUILD_CONTAINER",
        "IMAGE_TAG_JAVA_MAVEN_BUILD_CONTAINER",
        "IMAGE_TAG_PHP_BUILD_CONTAINER",
        "IMAGE_TAG_GOLANG_BUILD_CONTAINER",
        "IMAGE_TAG_RUBY_BUILD_CONTAINER",
        "IMAGE_TAG_GIT_MERGE_WORKER",
        "IMAGE_TAG_STORM_RUNNER_WORKER",
        "IMAGE_TAG_CLOUD_FOUNDRY_WORKER",
        "IMAGE_TAG_BUILD_EVENT_NOTIFIER",
        "IMAGE_TAG_HIPCHAT_NOTIFIER",
        "IMAGE_TAG_HTTP_NOTIFIER",
        "IMAGE_TAG_GITHUB_PR_NOTIFIER",
        "IMAGE_TAG_BITBUCKET_PR_NOTIFIER",
        "IMAGE_TAG_FLOWDOCK_NOTIFIER",
        "IMAGE_TAG_SLACK_NOTIFIER"
      ],
        sqlVariables = {},
        sqlVariablesDeclarationScript = '',
        filePath = './database/versions/0.0.0.sql';

      _.each(tagNames, (tagName) => {
        sqlVariables[tagName] = getImageTag(tagName);
      });

      if (process.env.IMAGE_REGISTRY_URL) {
        sqlVariables["IMAGE_REGISTRY_URL"] = process.env.IMAGE_REGISTRY_URL;
      } else {
        sqlVariables["IMAGE_REGISTRY_URL"] = "https://registry-1.docker.io/foobar";
      }

      if (process.env.DOCKER_USERNAME && process.env.DOCKER_PASSWORD) {
        sqlVariables["DOCKER_USERNAME"] = process.env.DOCKER_USERNAME;
        sqlVariables["DOCKER_PASSWORD"] = process.env.DOCKER_PASSWORD;
        sqlVariables["CREATE_SYSTEM_CREDENTIAL"] = true;
      }

      // SET @IMAGE_TAG_NODEJS_BUILD_CONTAINER='custom-tag'
      for (var tag in sqlVariables) {
        sqlVariablesDeclarationScript += `SET @${tag}='${sqlVariables[tag]}';\n`
      }

      fs.writeFile(filePath, sqlVariablesDeclarationScript, (err) => {
        if (err) {
          utils.logger.error(err.message);
          return reject(err);
        }

        utils.logger.info(`Generated ${filePath}`);
        return resolve();
      });
    });
}

function getImageTag(preferredTagName) {
  // The order of precedence is :
  // 1. Custom Tag value for a build container, e.g. IMAGE_TAG_NODEJS_BUILD_CONTAINER
  // 2. Global tag value for all containers, i.e. value of DOCKER_IMAGE_TAG
  // 3. Well known tag name, i.e. kosher-prod
  var preferredTag;
  if (process.env[preferredTagName]) {
    preferredTag = process.env[preferredTagName];
  }
  return preferredTag || process.env.DOCKER_IMAGE_TAG || "kosher-prod";
}

function getCurrentDbVersion() {
  return new Promise(
    function (resolve, reject) {
      var currentMaxVersion = semver('0.0.0');

      var done = (err, maxVersion) => {
        if (err) {
          utils.logger.error(err);
          return reject(err);
        }

        utils.logger.info(`Existing database version [${maxVersion}] found.`);

        return resolve(maxVersion);
      };

      async.waterfall([
          getConnection,
          getCurrentVersions,
          getMaxVersion
        ], done);

      function getConnection(callback) {
        utils.database.connection((err, conn) => {
          return callback(err, conn);
        });
      }

      function getCurrentVersions(database, callback) {
        return database.driver.execQuery('select version from dbversion', (err, results) => {
          if (err) {
            // if this query fails, it can mean one of few things.
            // 1. The DB is unintialized.
            // 2. Someone deleted the table.
            // For both of these cases, we need to re-initiaizle the DB
            return callback(null, [{
                version: '0.0.0'
              }
            ]);
          }

          return callback(err, results);
        });
      }

      function getMaxVersion(versions, callback) {
        try {
          _.each(versions, (versionRow) => {
            var currentVersion = semver(versionRow.version);
            if (semver.lt(currentMaxVersion, currentVersion)) {
              currentMaxVersion = currentVersion;
            }
          });
          return callback(null, currentMaxVersion);
        } catch (error) {
          return callback(error);
        }
      }
    });
}

function updateDatabase(result) {
  return new Promise(
    function (resolve, reject) {
      var requiredVersion = semver(packageJSON.config.database.version),
        updateRequired = result[0],
        existingVersion = result[1];
      if (updateRequired) {
        utils.logger.info(`Database upgrade required, from [${existingVersion}] to [${requiredVersion}]`);
        setupHelpers.setupDatabase(existingVersion, requiredVersion, (err) => {
          if (err) {
            utils.logger.error(err.message);
            return reject(err);
          }
          return resolve();
        });
      } else {
        return resolve();
      }
    });
}
