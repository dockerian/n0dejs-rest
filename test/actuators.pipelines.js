var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  uuid = require('uuid'),
  actuators = require('../utils/actuators'),
  testHelpers = require('./_helpers.js'),
  utils = require('../utils');

describe('actuators/pipelines', () => {
  var mockedExecution, mockedConcourseClient, logger, testId;
  var savedConnection, savedClient;

  describe('startExecution', () => {

    before(() => {
      savedConnection = utils.database.connection;
      savedClient = utils.concourse.client;

      utils.logger.transports['buffer'].level = 'debug';
      utils.logger.transports['console'].level = 'silent';

      testHelpers.refreshSettings();
    });

    beforeEach(() => {
      utils.settings.getSystemConfigurationValue = sinon.stub().callsArgWith(1, null, "1");
    });

    after(() => {
      utils.database.connection = savedConnection;
      utils.concourse.client = savedClient;
    });

    afterEach(() => {
      testHelpers.refreshSettings();
    });

    it("Should error if missing deployment target, ORM error", (done) => {
      var error = new Error("Unable to find deployment target");
      var mockedProject = {
        getDeploymentTarget: sinon.stub().callsArgWith(0, error)
      };
      utils.database.connection = sinon.stub().callsArgWith(0, null, {});

      actuators.pipelines.startExecution('push', mockedProject, {}, utils.logger, (err) => {
        err.should.be.equal(error);
        done();
      });
    });

    it("Should error if missing deployment target, misbehaving ORM", (done) => {
      var mockedProject = {
        id: 16,
        getDeploymentTarget: sinon.stub().callsArgWith(0, null, null)
      };
      utils.database.connection = sinon.stub().callsArgWith(0, null, {});

      actuators.pipelines.startExecution('push', mockedProject, {}, utils.logger, (err) => {
        err.message.should.be.equal('No target was returned for project with id:16')
        done();
      });
    });

    it("Should return a 503 error if pipeline creation is disabled", (done) => {
      var mockedTarget = {
          id: 2
        },
        mockedProject = {
          id: 16,
          getDeploymentTarget: sinon.stub().callsArgWith(0, null, mockedTarget)
        };

      utils.database.connection = sinon.stub().callsArgWith(0, null, {});
      utils.settings.getSystemConfigurationValue = sinon.stub().callsArgWith(1, null, "0");

      actuators.pipelines.startExecution('push', mockedProject, {}, utils.logger, (err) => {
        err.message.should.be.equal('Server Maintenance')
        err.status.should.be.equal(503);
        done();
      });
    });

    it("Should fail when getting system configuration errors", (done) => {
      var mockedProject = {
        id: 16,
        getDeploymentTarget: sinon.stub().callsArgWith(0, null, null)
      };

      utils.database.connection = sinon.stub().callsArgWith(0, null, {});
      utils.settings.getSystemConfigurationValue = sinon.stub().callsArgWith(1, new Error("Error fetching value"));

      actuators.pipelines.startExecution('push', mockedProject, {}, utils.logger, (err) => {
        err.should.not.equal(null);
        err.message.should.equal("Error fetching value");
        done();
      });

    });
  });

  describe('abortExecution', () => {
    before(() => {
      savedConnection = utils.database.connection;
      savedClient = utils.concourse.client;

      utils.logger.transports['buffer'].level = 'debug';
      utils.logger.transports['console'].level = 'silent';
      testHelpers.refreshSettings();
    });

    after(() => {
      utils.database.connection = savedConnection;
      utils.concourse.client = savedClient;
    });

    afterEach(() => {
      testHelpers.refreshSettings();
    });

    beforeEach(() => {
      testId = uuid.v1();
      logger = utils.logger.shim(utils.logger, testId);

      mockedExecution = {
        id: 13,
        concourse_pipeline_id: 'concourse_pipeline_id',
        save: sinon.stub()
      };

      mockedConcourseClient = {
        abortPipeline: sinon.stub(),
        destroyPipeline: sinon.stub()
      };

      utils.database.connection = sinon.stub().callsArgWith(0, null, {});
      utils.concourse.client = sinon.stub().returns(mockedConcourseClient);
      utils.settings.concourse = {
        apiUrl: 'http://concourseUri',
        username: 'CONCOURSE_USERNAME',
        password: 'CONCOURSE_PASSWORD',
        registryMirrorUrl: 'http://somemirror:5000/'
      };
    });

    it('should abort execution', (done) => {
      mockedConcourseClient.abortPipeline.callsArgWith(2, null);
      mockedConcourseClient.destroyPipeline.callsArgWith(1, null);
      mockedExecution.save.callsArgWith(0, null);

      actuators.pipelines.abortExecution(mockedExecution, logger, (err) => {
        should.not.exist(err);

        mockedExecution.result.should.be.equal('Timed Out');
        mockedExecution.save.calledOnce.should.be.true();
        mockedConcourseClient.abortPipeline.calledWith('concourse_pipeline_id', 13).should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          // TODO: a successful abort should log *something*
          entries.length.should.equal(0);
          return done();
        });
      });
    });

    it('should handle errors aborting pipeline', (done) => {
      mockedConcourseClient.abortPipeline.callsArgWith(2, new Error('CONCOURSE_UNREACHABLE'));
      mockedConcourseClient.destroyPipeline.callsArgWith(1, null);
      mockedExecution.save.callsArgWith(0, null);

      actuators.pipelines.abortExecution(mockedExecution, logger, (err) => {
        should.not.exist(err);

        mockedExecution.result.should.be.equal('Timed Out');
        mockedExecution.save.calledOnce.should.be.true();
        mockedConcourseClient.abortPipeline.calledWith('concourse_pipeline_id', 13).should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].level.should.equal('warn');
          entries[0].message.should.equal(`${testId} : abortExecution : Unable to abort concourse pipeline`);
          entries[1].level.should.equal('warn');
          entries[1].message.should.equal(`${testId} : abortExecution : CONCOURSE_UNREACHABLE`);
          return done();
        });
      });
    });

    it('should handle errors desroying pipeline', (done) => {
      mockedConcourseClient.abortPipeline.callsArgWith(2, null);
      mockedConcourseClient.destroyPipeline.callsArgWith(1, new Error('CONCOURSE_UNREACHABLE'));
      mockedExecution.save.callsArgWith(0, null);

      actuators.pipelines.abortExecution(mockedExecution, logger, (err) => {
        should.not.exist(err);

        mockedExecution.result.should.be.equal('Timed Out');
        mockedExecution.save.calledOnce.should.be.true();
        mockedConcourseClient.abortPipeline.calledWith('concourse_pipeline_id', 13).should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].level.should.equal('warn');
          entries[0].message.should.equal(`${testId} : abortExecution : Unable to destroy concourse pipeline`);
          entries[1].level.should.equal('warn');
          entries[1].message.should.equal(`${testId} : abortExecution : CONCOURSE_UNREACHABLE`);
          return done();
        });
      });
    });

    it('should handle errors updating executionRow', (done) => {
      mockedConcourseClient.abortPipeline.callsArgWith(2, null);
      mockedConcourseClient.destroyPipeline.callsArgWith(1, null);
      mockedExecution.save.callsArgWith(0, new Error('NOT_FOUND'));

      actuators.pipelines.abortExecution(mockedExecution, logger, (err) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('NOT_FOUND');

        mockedExecution.result.should.be.equal('Timed Out');
        mockedExecution.save.calledOnce.should.be.true();
        mockedConcourseClient.abortPipeline.calledWith('concourse_pipeline_id', 13).should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(0);
          return done();
        });
      });
    });
  });
});
