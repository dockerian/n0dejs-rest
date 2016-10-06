var _ = require('lodash'),
  shell = require('shelljs'),
  fs = require('fs'),
  should = require('should'),
  sinon = require('sinon'),
  uuid = require('uuid'),
  utils = require('../utils'),
  packageJSON = require('../package.json'),
  testHelpers = require('./_helpers.js');

describe('utils/database/setup', () => {
  var mockedError, testId, silentFlag, mockedConnection;
  var savedVersion, savedShellExec, savedLogger, savedWriteFile;

  before(() => {
    // Silence all but the buffer, we need to peek the logs for validation.
    _.each(Object.keys(utils.logger.transports), (transportType) => {
      if (transportType === 'buffer') {
        utils.logger.transports[transportType].level = 'debug';
      } else {
        utils.logger.transports[transportType].level = 'silent';
      }
    });

    process.env.DOCKER_USERNAME = 'dockerlogin';
    process.env.DOCKER_PASSWORD = 'dockerpassword';

    savedVersion = packageJSON.config.database.version;
    savedShellExec = shell.exec;
    savedLogger = utils.logger;
  });

  after(() => {
    testHelpers.refreshSettings();
    delete require.cache[require.resolve('../utils/database/setup.js')];

    packageJSON.config.database.version = savedVersion;
    utils.logger = savedLogger;
    fs.writeFile = savedWriteFile;
  });

  beforeEach(() => {
    mockedError = new Error('Mocked Error');
    utils.logger = savedLogger.shim(savedLogger, testId = uuid.v1());

    packageJSON.config.database.version;
    shell.exec = sinon.stub();

    savedWriteFile = fs.writeFile;
    fs.writeFile = sinon.stub().callsArgWith(2, null);

    silentFlag = {
      silent: true
    };

    mockedDB = {
      driver: {
        execQuery: sinon.stub().callsArgWith(1, null, [
          {
            version: '1.0.1'
          },
          {
            version: '1.0.0'
          },
          {
            version: '0.0.0'
          }
        ], sinon.stub().throws(" SHOULD NOT BE CALLED"))
      },
      models: {
        credential: {
          find: sinon.stub().callsArgWith(1, null, [{
            credential_id: 1
          }]),
          create: sinon.stub()
        }
      }
    };

    mockedConnection = sinon.stub().callsArgWith(0, null, mockedDB);
    utils.database.connection = mockedConnection;
    utils.settings.database = {
      host: 'usd.host',
      port: 'usd.port',
      database: 'usd.database',
      password: 'usd.password',
      user: 'usd.user',
      encryptionKeyFile: './tools/dbencryptionkey'
    };
  });

  describe("generateImageTagsFile", () => {
    var query, checkConnectionCommand, insertStatement, createCredentialCommand, credential_id, updateImageCommand, updateStatement;

    beforeEach(() => {
      var usd = utils.settings.database;

      credential_id = 1;
      checkConnectionCommand = `mysql -h"${usd.host}" -P"${usd.port}" -u"${usd.user}" -p"${usd.password}" -s -e "exit"`;
      updateStatement = `UPDATE image set credential_id = '${credential_id}' where image_label like 'foo_%'`;
      updateImageCommand = `mysql -h"${usd.host}" -P"${usd.port}" -D"${usd.database}" -u"${usd.user}" -p"${usd.password}" -s -e "${updateStatement}"`;
    });

    it("Should generate variables file with image tags", (done) => {
      packageJSON.config.database.version = '1.0.1';

      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');
      shell.exec.callsArgWith(1, 0, '');

      fs.writeFile = sinon.stub().callsArgWith(2, null)

      process.env.IMAGE_TAG_PYTHON_BUILD_CONTAINER = 'my-custom-python-tag';
      process.env.IMAGE_TAG_NODEJS_BUILD_CONTAINER = 'my-custom-nodejs-tag';
      process.env.IMAGE_TAG_JAVA_MAVEN_BUILD_CONTAINER = 'my-custom-java-maven-tag';
      process.env.IMAGE_TAG_PHP_BUILD_CONTAINER = 'my-custom-php-tag';
      process.env.IMAGE_TAG_GOLANG_BUILD_CONTAINER = 'my-custom-golang-tag';
      process.env.IMAGE_TAG_GIT_MERGE_WORKER = 'my-custom-gitMerge-tag';
      process.env.IMAGE_TAG_STORM_RUNNER_WORKER = 'my-custom-stormRunner-tag';
      process.env.IMAGE_TAG_CLOUD_FOUNDRY_WORKER = 'my-custom-cloudFoundry-tag';
      process.env.IMAGE_TAG_BUILD_EVENT_NOTIFIER = 'my-custom-buildEvent-tag';
      process.env.IMAGE_TAG_HIPCHAT_NOTIFIER = 'my-custom-hipchat-tag';
      process.env.IMAGE_TAG_HTTP_NOTIFIER = 'my-custom-http-tag';
      process.env.IMAGE_TAG_GITHUB_PR_NOTIFIER = 'my-custom-githubpullrequest-tag';
      process.env.IMAGE_TAG_BITBUCKET_PR_NOTIFIER = 'my-custom-bitbucketpullrequest-tag';
      process.env.IMAGE_TAG_FLOWDOCK_NOTIFIER = 'my-custom-flowdock-tag';
      process.env.IMAGE_TAG_SLACK_NOTIFIER = 'my-custom-slack-tag';

      utils.database
        .setup()
        .then(() => {
          var fileContents = fs.writeFile.getCall(0).args[1];
          fileContents.indexOf("SET @IMAGE_TAG_PYTHON_BUILD_CONTAINER='my-custom-python-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_NODEJS_BUILD_CONTAINER='my-custom-nodejs-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_JAVA_MAVEN_BUILD_CONTAINER='my-custom-java-maven-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_PHP_BUILD_CONTAINER='my-custom-php-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_GOLANG_BUILD_CONTAINER='my-custom-golang-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_GIT_MERGE_WORKER='my-custom-gitMerge-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_STORM_RUNNER_WORKER='my-custom-stormRunner-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_CLOUD_FOUNDRY_WORKER='my-custom-cloudFoundry-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_BUILD_EVENT_NOTIFIER='my-custom-buildEvent-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_HIPCHAT_NOTIFIER='my-custom-hipchat-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_HTTP_NOTIFIER='my-custom-http-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_GITHUB_PR_NOTIFIER='my-custom-githubpullrequest-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_BITBUCKET_PR_NOTIFIER='my-custom-bitbucketpullrequest-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_FLOWDOCK_NOTIFIER='my-custom-flowdock-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_SLACK_NOTIFIER='my-custom-slack-tag';").should.not.be.equal(-1);

          fileContents.indexOf("SET @IMAGE_REGISTRY_URL='https://registry-1.docker.io/foobar';").should.not.be.equal(-1);
          delete process.env.IMAGE_TAG_PYTHON_BUILD_CONTAINER
          delete process.env.IMAGE_TAG_NODEJS_BUILD_CONTAINER;
          delete process.env.IMAGE_TAG_JAVA_MAVEN_BUILD_CONTAINER;
          delete process.env.IMAGE_TAG_PHP_BUILD_CONTAINER;
          delete process.env.IMAGE_TAG_GOLANG_BUILD_CONTAINER;
          delete process.env.IMAGE_TAG_GIT_MERGE_WORKER;
          delete process.env.IMAGE_TAG_STORM_RUNNER_WORKER;
          delete process.env.IMAGE_TAG_CLOUD_FOUNDRY_WORKER;
          delete process.env.IMAGE_TAG_BUILD_EVENT_NOTIFIER;
          delete process.env.IMAGE_TAG_HIPCHAT_NOTIFIER;
          delete process.env.IMAGE_TAG_HTTP_NOTIFIER;
          delete process.env.IMAGE_TAG_GITHUB_PR_NOTIFIER;
          delete process.env.IMAGE_TAG_BITBUCKET_PR_NOTIFIER;
          delete process.env.IMAGE_TAG_FLOWDOCK_NOTIFIER;
          delete process.env.IMAGE_TAG_SLACK_NOTIFIER;
          done();
        });
    });

    it("Should generate variables file with API system registry", (done) => {
      packageJSON.config.database.version = '1.0.1';
      fs.writeFile = sinon.stub().callsArgWith(2, null);
      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');

      process.env.IMAGE_REGISTRY_URL = 'http://docker.foobar.space';
      utils.database
        .setup()
        .then(() => {
          var fileContents = fs.writeFile.getCall(0).args[1];
          fileContents.indexOf("SET @IMAGE_REGISTRY_URL='http://docker.foobar.space';").should.not.be.equal(-1);
          delete process.env.IMAGE_REGISTRY_URL;
          done();
        });

    });

    it("Should generate variables file with DOCKER_IMAGE_TAG tags", (done) => {
      packageJSON.config.database.version = '1.0.1';
      fs.writeFile = sinon.stub().callsArgWith(2, null);
      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');

      process.env.DOCKER_IMAGE_TAG = 'my-custom-docker-image-tag';

      utils.database
        .setup()
        .then(() => {
          var fileContents = fs.writeFile.getCall(0).args[1];
          fileContents.indexOf("SET @IMAGE_TAG_PYTHON_BUILD_CONTAINER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_NODEJS_BUILD_CONTAINER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_JAVA_MAVEN_BUILD_CONTAINER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_PHP_BUILD_CONTAINER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_GOLANG_BUILD_CONTAINER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_GIT_MERGE_WORKER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_STORM_RUNNER_WORKER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_CLOUD_FOUNDRY_WORKER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_BUILD_EVENT_NOTIFIER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_HIPCHAT_NOTIFIER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_HTTP_NOTIFIER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_GITHUB_PR_NOTIFIER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_BITBUCKET_PR_NOTIFIER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_FLOWDOCK_NOTIFIER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_SLACK_NOTIFIER='my-custom-docker-image-tag';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_REGISTRY_URL='https://registry-1.docker.io/foobar';").should.not.be.equal(-1);
          delete process.env.DOCKER_IMAGE_TAG;
          done();
        });
    });

    it("Should generate variables file with 'kosher-prod' tags", (done) => {
      packageJSON.config.database.version = '1.0.1';
      fs.writeFile = sinon.stub().callsArgWith(2, null);
      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');
      utils.database
        .setup()
        .then(() => {
          var fileContents = fs.writeFile.getCall(0).args[1];
          fileContents.indexOf("SET @IMAGE_TAG_PYTHON_BUILD_CONTAINER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_NODEJS_BUILD_CONTAINER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_JAVA_MAVEN_BUILD_CONTAINER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_PHP_BUILD_CONTAINER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_GOLANG_BUILD_CONTAINER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_GIT_MERGE_WORKER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_STORM_RUNNER_WORKER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_CLOUD_FOUNDRY_WORKER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_BUILD_EVENT_NOTIFIER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_HIPCHAT_NOTIFIER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_HTTP_NOTIFIER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_GITHUB_PR_NOTIFIER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_BITBUCKET_PR_NOTIFIER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_FLOWDOCK_NOTIFIER='kosher-prod';").should.not.be.equal(-1);
          fileContents.indexOf("SET @IMAGE_TAG_SLACK_NOTIFIER='kosher-prod';").should.not.be.equal(-1);
          done();
        });
    });

    it("Should handle failure writing image tags file", (done) => {
      packageJSON.config.database.version = '1.0.1';

      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: '1.0.1'
        },
        {
          version: '1.0.0'
        },
        {
          version: '0.0.0'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));

      fs.writeFile = sinon.stub().callsArgWith(2, new Error("Cannot write image tags file"))
      process.env.IMAGE_TAG_PYTHON_BUILD_CONTAINER = 'my-custom-python-tag';
      process.env.IMAGE_TAG_NODEJS_BUILD_CONTAINER = 'my-custom-nodejs-tag';
      process.env.IMAGE_TAG_JAVA_MAVEN_BUILD_CONTAINER = 'my-custom-java-maven-tag';
      process.env.IMAGE_TAG_PHP_BUILD_CONTAINER = 'my-custom-php-tag';
      process.env.IMAGE_TAG_GOLANG_BUILD_CONTAINER = 'my-custom-golang-tag';
      process.env.IMAGE_TAG_RUBY_BUILD_CONTAINER = 'my-custom-ruby-tag';

      utils.database
        .setup()
        .catch((err) => {
          err.message.should.equal("Cannot write image tags file");
          delete process.env.IMAGE_TAG_PYTHON_BUILD_CONTAINER
          delete process.env.IMAGE_TAG_NODEJS_BUILD_CONTAINER;
          delete process.env.IMAGE_TAG_JAVA_MAVEN_BUILD_CONTAINER;
          delete process.env.IMAGE_TAG_PHP_BUILD_CONTAINER;
          delete process.env.IMAGE_TAG_GOLANG_BUILD_CONTAINER;
          done();
        });
    });

  });

  describe('setupDbIfNotSetup', () => {
    var query, checkConnectionCommand, insertStatement, createCredentialCommand, updateImageCommand, updateStatement;

    beforeEach(() => {
      var usd = utils.settings.database;
      credential_id = 1;
      updateStatement = `UPDATE image set credential_id = '${credential_id}' where image_label like 'foo_%'`;
      updateImageCommand = `mysql -h"${usd.host}" -P"${usd.port}" -D"${usd.database}" -u"${usd.user}" -p"${usd.password}" -s -e "${updateStatement}"`;
      checkConnectionCommand = `mysql -h"${usd.host}" -P"${usd.port}" -u"${usd.user}" -p"${usd.password}" -s -e "exit"`;
    });

    it('should verify a database is not at a higher version than required', (done) => {
      packageJSON.config.database.version = '1.0.1';

      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');
      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: '1.0.5'
        },
        {
          version: '1.0.0'
        },
        {
          version: '0.0.0'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));

      utils.database
        .verify()
        .then(() => {
          throw new Error('return success instead of failure');
        }, (err) => {
          should.exist(err);
          err.should.be.an.instanceof(Error);
          err.message.should.equal(`Database version (1.0.5) is higher than the required version (1.0.1).`);
          done();
        })
        .catch(done);
    });

    it('should verify a database is available and at the most recent version', (done) => {
      packageJSON.config.database.version = '1.0.1';

      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: '1.0.1'
        },
        {
          version: '1.0.0'
        },
        {
          version: '0.0.0'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));

      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      utils.database
        .verify()
        .then(() => {
          savedLogger.getEntriesForId(testId, (entries) => {
            done();
          });
        })
        .catch(done);
    });

    it('should fail verify when the database isn\'t updated', (done) => {
      packageJSON.config.database.version = '1.0.1';

      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: '1.0.0'
        },
        {
          version: '1.0.0'
        },
        {
          version: '0.0.0'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));

      utils.database
        .verify()
        .then(() => {
          throw new Error('return success instead of failure');
        }, (err) => {
          should.exist(err);
          err.should.be.an.instanceof(Error);
          err.message.should.equal('Database must be updated to 1.0.1');
          done();
        })
        .catch(done);
    });

    it('should setup a database from scratch', (done) => {
      packageJSON.config.database.version = '1.0.1';

      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: '0.0.0'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));
      shell.exec.callsArgWith(1, 0, '');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');
      mockedDB.models.credential.find.callsArgWith(1, null, []);
      mockedDB.models.credential.create.callsArgWith(1, null, {
        credential_id: 1
      });
      utils.database
        .setup()
        .then(() => {
          shell.exec.getCall(0).args[0].should.equal('mysql -h"usd.host" -P"usd.port" -u"usd.user" -p"usd.password" -s -e "exit"');
          savedLogger.getEntriesForId(testId, (entries) => {
            entries[1].message.should.equal(`${testId} : Mysql service available.`);
            entries[2].message.should.equal(`${testId} : Existing database version [0.0.0] found.`);
            entries[3].message.should.equal(`${testId} : Database upgrade required, from [0.0.0] to [1.0.1]`);
            entries[4].message.should.equal(`${testId} : Importing schema version : 1.0.0`);
            entries[5].message.should.equal(`${testId} : Schema version [ 1.0.0 ] imported successfully`);
            entries[6].message.should.equal(`${testId} : Importing schema version : 1.0.1`);
            entries[7].message.should.equal(`${testId} : Schema version [ 1.0.1 ] imported successfully`);
            entries[8].message.should.equal(`${testId} : Looking for existing system Image credentials`);
            entries[9].message.should.equal(`${testId} : Creating new system Image credentials`);
            entries[10].message.should.equal(`${testId} : Images are successfully updated with credential_id: 1.`);
            mockedDB.models.credential.find.calledWith({
              label: "foo_system_image_credentials"
            }).should.be.true();
            mockedDB.models.credential.create.calledOnce.should.be.true();
            done();
          });
        })
        .catch(done);
    });

    it('should contnue on after failures to get current db version', (done) => {
      packageJSON.config.database.version = '1.0.1';
      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');
      shell.exec.callsArgWith(1, 0, '');
      mockedDB.driver.execQuery.callsArgWith(1, new Error("Unable to connect to DB"));
      utils.database
        .setup()
        .then(() => {
          shell.exec.getCall(0).args[0].should.equal('mysql -h"usd.host" -P"usd.port" -u"usd.user" -p"usd.password" -s -e "exit"');

          savedLogger.getEntriesForId(testId, (entries) => {
            entries[1].message.should.equal(`${testId} : Mysql service available.`);
            entries[2].message.should.equal(`${testId} : Existing database version [0.0.0] found.`);
            entries[3].message.should.equal(`${testId} : Database upgrade required, from [0.0.0] to [1.0.1]`);
            entries[4].message.should.equal(`${testId} : Importing schema version : 1.0.0`);
            entries[5].message.should.equal(`${testId} : Schema version [ 1.0.0 ] imported successfully`);
            entries[6].message.should.equal(`${testId} : Importing schema version : 1.0.1`);
            entries[7].message.should.equal(`${testId} : Schema version [ 1.0.1 ] imported successfully`);
            done();
          });
        })
        .catch(done);
    });

    it('should handle failures calculating current db version', (done) => {
      packageJSON.config.database.version = '1.0.1';
      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');
      shell.exec.callsArgWith(1, 0, '');
      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: 'thisisnotaversionstring'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));
      utils.database
        .setup()
        .then(() => {
          throw new Error('return success instead of failure');
        }, (err) => {
          should.exist(err);
          done();
        })
        .catch(done);
    });

    it('should upgrade a database', (done) => {
      packageJSON.config.database.version = '1.0.1';
      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');
      shell.exec.callsArgWith(1, 0, '');
      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: '1.0.0'
          },
        {
          version: '0.0.0'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));
      utils.database
        .setup()
        .then(() => {
          shell.exec.getCall(0).args[0].should.equal('mysql -h"usd.host" -P"usd.port" -u"usd.user" -p"usd.password" -s -e "exit"');

          savedLogger.getEntriesForId(testId, (entries) => {
            entries[1].message.should.equal(`${testId} : Mysql service available.`);
            entries[2].message.should.equal(`${testId} : Existing database version [1.0.0] found.`);
            entries[3].message.should.equal(`${testId} : Database upgrade required, from [1.0.0] to [1.0.1]`);
            entries[4].message.should.equal(`${testId} : Importing schema version : 1.0.1`);
            entries[5].message.should.equal(`${testId} : Schema version [ 1.0.1 ] imported successfully`);
            done();
          });
        })
        .catch(done);
    });

    it('should not do anything if the database is the right version', (done) => {
      packageJSON.config.database.version = '1.0.7';
      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');

      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: '1.0.0'
        },
        {
          version: '1.0.7'
        },
        {
          version: '0.0.0'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));

      utils.database
        .setup()
        .then(() => {
          shell.exec.callCount.should.equal(2);
          shell.exec.getCall(0).args[0].should.equal('mysql -h"usd.host" -P"usd.port" -u"usd.user" -p"usd.password" -s -e "exit"');

          savedLogger.getEntriesForId(testId, (entries) => {
            entries[1].message.should.equal(`${testId} : Mysql service available.`);
            entries[2].message.should.equal(`${testId} : Existing database version [1.0.7] found.`);
            done();
          });
        })
        .catch(done);
    });

    it('should fail if scripts are not available to reach the desired version', (done) => {
      packageJSON.config.database.version = '99.99.99';
      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: '1.0.0'
        },
        {
          version: '1.0.3'
        },
        {
          version: '0.0.0'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));

      utils.database
        .setup()
        .then(() => {
          throw new Error('return success instead of failure');
        }, (err) => {
          should.exist(err);
          err.should.be.an.instanceof(Error);
          err.message.should.equal('DB upgrade script for version [99.99.99] required by rest-service was not found.');

          savedLogger.getEntriesForId(testId, (entries) => {
            entries[1].message.should.equal(`${testId} : Mysql service available.`);
            entries[2].message.should.equal(`${testId} : Existing database version [1.0.3] found.`);
            entries[3].message.should.equal(`${testId} : Database upgrade required, from [1.0.3] to [99.99.99]`);
            done();
          });
        })
        .catch(done);
    });

    it('should fail if an individual upgrade fails', (done) => {
      packageJSON.config.database.version = '1.0.1';
      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 0, '');
      shell.exec.callsArgWith(1, 1, '1.0.1 import fail :(');
      mockedDB.driver.execQuery.callsArgWith(1, null, [
        {
          version: '1.0.0'
        }
      ], sinon.stub().throws(" SHOULD NOT BE CALLED"));
      utils.database
        .setup()
        .then(() => {
          throw new Error('return success instead of failure');
        }, (err) => {
          should.exist(err);
          err.should.be.an.instanceof(Error);
          err.message.should.equal('Schema version [1.0.1] import failed: 1.0.1 import fail :(');

          savedLogger.getEntriesForId(testId, (entries) => {
            entries[1].message.should.equal(`${testId} : Mysql service available.`);
            entries[2].message.should.equal(`${testId} : Existing database version [1.0.0] found.`);
            entries[3].message.should.equal(`${testId} : Database upgrade required, from [1.0.0] to [1.0.1]`);
            entries[4].message.should.equal(`${testId} : Importing schema version : 1.0.1`);
            entries[5].message.should.equal(`${testId} : Schema version [ 1.0.1 ] import failed`);
            done();
          });
        })
        .catch(done);
    });

    it('should fail if a db connection cannot be achieved', (done) => {
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 1, 'no db for you!');

      utils.database
        .setup()
        .then(() => {
          throw new Error('return success instead of failure');
        }, (err) => {
          should.exist(err);
          err.should.be.an.instanceof(Error);
          err.message.should.equal('Unable to establish database connection');
          done();
        })
        .catch(done);
    });

    it('should handle failure to create credential.', (done) => {
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      mockedDB.models.credential.find.callsArgWith(1, null, []);
      mockedDB.models.credential.create.callsArgWith(1, new Error("Failed to create a credential."));

      utils.database
        .setup()
        .then(() => {
          throw new Error('return success instead of failure');
        }, (err) => {
          should.exist(err);
          err.should.be.an.instanceof(Error);
          err.message.should.equal('Failed to create a credential.');
          done();
        })
        .catch(done);
    });

    it('should fail to update images with credential.', (done) => {
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.withArgs(updateImageCommand, silentFlag).callsArgWith(2, 1, '');

      shell.exec.callsArgWith(1, 0, '');
      utils.database
        .setup()
        .then(() => {
          throw new Error('return success instead of failure');
        }, (err) => {
          should.exist(err);
          err.should.be.an.instanceof(Error);
          err.message.should.equal('Failed to update images with credential_id.');

          savedLogger.getEntriesForId(testId, (entries) => {
            _.some(entries, (entry) => {
              return entry.message === `${testId} : Failed to update images with credential_id.` && entry.level === 'error';
            }).should.be.true();
            done();
          });
        })
        .catch(done);
    });



    it('should skip creating credential if DOCKER_USERNAME && DOCKER_PASSWORD are not set.', (done) => {
      packageJSON.config.database.version = '1.0.1';

      // shell.exec will be called to connect, check version, and run .sql files
      shell.exec.withArgs(checkConnectionCommand, silentFlag).callsArgWith(2, 0, 'db connected');
      shell.exec.callsArgWith(1, 0, '');

      mockedDB.models.credential.find.throws(new Error("SHOULD NOT be called."));
      mockedDB.models.credential.create.throws(new Error("SHOULD NOT create credential."));
      shell.exec.callsArgWith(1, 0, '');
      delete process.env.DOCKER_USERNAME;
      delete process.env.DOCKER_PASSWORD;
      utils.database
        .setup()
        .then(() => {
          shell.exec.callCount.should.equal(1);
          mockedDB.models.credential.find.calledOnce.should.be.false();
          mockedDB.models.credential.create.calledOnce.should.be.false();
          done();
        })
        .catch(done);
    });

  });
});
