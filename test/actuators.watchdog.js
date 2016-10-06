var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  uuid = require('uuid'),
  actuators = require('../utils/actuators'),
  utils = require('../utils');

describe('actuators/watchdog', () => {
  var mockedRunningExecutions, mockedConnection, mockedClient, mockedJobs, logger, testId;
  var savedConnection, savedClient, savedArtifactActuator;

  before(() => {
    savedConnection = utils.database.connection;
    savedClient = utils.concourse.client;
    savedArtifactActuator = actuators.artifacts;

    utils.logger.transports['buffer'].level = 'debug';
    utils.logger.transports['console'].level = 'silent';
  });

  after(() => {
    utils.database.connection = savedConnection;
    utils.concourse.client = savedClient;
    actuators.artifacts = savedArtifactActuator;
  });

  beforeEach(() => {
    testId = uuid.v1();
    logger = utils.logger.shim(utils.logger, testId);

    mockedConnection = {
      models: {
        build: {
          find: sinon.stub()
        },
        build_step: {
          create: sinon.stub(),
          find: sinon.stub()
        }
      },
      driver: {
        execQuery: sinon.stub()
      }
    };

    mockedExecution = {
      id: 123,
      name: 'some_file.txt',
      build_id: 456,
      type: 'test',
      createdDate: new Date(Date.now())
    };

    mockedClient = {
      getPipelineJobs: sinon.stub(),
      getPipelineLogs: sinon.stub()
    };

    mockedJobs = [{
      id: '945',
      pipeline: 'b9e551c0-1876-11e6-b12c-09f468abd91c',
      job: 'start-job-in-pipeline',
      build: '1',
      status: 'errored',
      start: '2016-05-12@12:21:46-0700',
      end: '2016-05-12@12:22:21-0700'
    }, {
      id: '944',
      pipeline: 'abc551c0-1876-11e6-b12c-09f468abd91c',
      job: 'start-job-in-pipeline',
      build: '112',
      status: 'succeeded',
      start: '2016-05-12@12:04:13-0700',
      end: '2016-05-12@12:31:19-0700'
    }, {
      id: '943',
      pipeline: '123551c0-1876-11e6-b12c-09f468abd91c',
      job: 'start-job-in-pipeline',
      build: '111',
      status: 'failed',
      start: '2016-05-12@11:28:53-0700',
      end: '2016-05-12@12:01:37-0700'
    }, {
      id: '931',
      pipeline: '987551c0-1876-11e6-b12c-09f468abd91c',
      job: 'start-job-in-pipeline',
      build: '108',
      status: 'aborted',
      start: '2016-05-11@16:31:18-0700',
      end: '2016-05-12@09:55:19-0700'
    }, {
      id: '939',
      pipeline: '654551c0-1876-11e6-b12c-09f468abd91c',
      job: 'start-job-in-pipeline',
      build: '102',
      status: 'pending',
      start: '2016-05-11@16:31:18-0700',
      end: '2016-05-12@09:55:19-0700'
    }, {
      id: '973',
      pipeline: 'xyze51c0-1876-11e6-b12c-09f468abd91c',
      job: 'start-job-in-pipeline',
      build: '101',
      status: 'started',
      start: '2016-05-11@16:31:18-0700',
      end: '2016-05-12@09:55:19-0700'
    }];

    mockedRunningExecutions = [{
      id: 1,
      concourse_pipeline_id: 'b9e551c0-1876-11e6-b12c-09f468abd91c'
    }, {
      id: 2,
      concourse_pipeline_id: '987551c0-1876-11e6-b12c-09f468abd91c'
    }, {
      id: 3,
      concourse_pipeline_id: 'missing1-1876-11e6-b12c-09f468abd91c'
    }, {
      id: 4,
      concourse_pipeline_id: 'xyze51c0-1876-11e6-b12c-09f468abd91c'
    }, {
      id: 5,
      concourse_pipeline_id: '654551c0-1876-11e6-b12c-09f468abd91c'
    }];

    _.each(mockedRunningExecutions, (ex) => {
      ex.save = sinon.stub();
      ex.save.callsArgWith(0, null);
    });

    actuators.artifacts = {
      createArtifact: sinon.stub()
    };

    utils.concourse.client = sinon.stub();
    utils.concourse.client.returns(mockedClient);
    utils.database.connection = sinon.stub();
    utils.database.connection.callsArgWith(0, null, mockedConnection);
  });

  describe('updateExecutionsFromConcourse', () => {

    // In this test, API thinks five executions are running. In Concourse, two
    // executions are running (pending / started), and two are stopped (errored / aborted),
    // and one is missing. We expect to see that API execution 1, 2, and 3 get
    // force-failed by the watchdog.
    it('should run a watchdog and do nothing if there are no active executions in API', (done) => {
      var mockedFailEvent1, mockedFailEvent2, mockedFailEvent3;

      mockedFailEvent1 = {
        artifact_id: null,
        save: sinon.stub()
      };
      mockedFailEvent2 = {
        artifact_id: null,
        save: sinon.stub()
      };
      mockedFailEvent3 = {
        artifact_id: null,
        save: sinon.stub()
      };

      mockedFailEvent1.save.callsArgWith(0, null);
      mockedFailEvent2.save.callsArgWith(0, null);
      mockedFailEvent3.save.callsArgWith(0, null);

      mockedConnection.driver.execQuery.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build.find.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build_step.create.onFirstCall().callsArgWith(1, null, mockedFailEvent1);
      mockedConnection.models.build_step.create.onSecondCall().callsArgWith(1, null, mockedFailEvent2);
      mockedConnection.models.build_step.create.onThirdCall().callsArgWith(1, null, mockedFailEvent3);
      mockedConnection.models.build_step.find.onFirstCall().callsArgWith(1, null, [mockedFailEvent1]);
      mockedConnection.models.build_step.find.onSecondCall().callsArgWith(1, null, [mockedFailEvent2]);
      mockedConnection.models.build_step.find.onThirdCall().callsArgWith(1, null, [mockedFailEvent3]);

      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);
      mockedClient.getPipelineLogs.callsArgWith(2, null, 'some logs');

      actuators.artifacts.createArtifact.callsArgWith(3, null, {});

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledWith({
          id: [1, 2, 3, 4, 5]
        });
        mockedConnection.models.build_step.create.calledThrice.should.be.true();
        mockedConnection.models.build_step.find.calledTwice.should.be.true();

        mockedClient.getPipelineJobs.calledOnce.should.be.true();
        mockedClient.getPipelineLogs.calledTwice.should.be.true();
        mockedFailEvent1.save.calledOnce.should.be.true();
        mockedFailEvent2.save.calledOnce.should.be.true();
        mockedFailEvent3.save.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(10);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 5 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 1, 2, 3, 4, 5.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 1 - Concourse pipeline status: errored.`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 2 - Concourse pipeline status: aborted.`);
          entries[5].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 0 executions for pipeline missing1-1876-11e6-b12c-09f468abd91c, did you delete it?`);
          entries[6].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 3 - Concourse pipeline status: Pipeline not found.`);
          entries[7].message.should.equal(`${testId} : updateExecutionsFromConcourse : API execution 4 is still running in concourse, skipping.`);
          entries[8].message.should.equal(`${testId} : updateExecutionsFromConcourse : API execution 5 is still running in concourse, skipping.`);
          entries[9].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // In this test, we want the first watchdog run to pause on the execQuery statement.
    // We will then try to trigger the second watchdog run from within the first (to
    // guarantee that they are running simultaneously).
    it('should not run a watchdog when its already running', (done) => {
      mockedConnection.models.build.find.callsArgWith(1, null, []);
      mockedClient.getPipelineJobs.callsArgWith(0, null, []);
      mockedConnection.driver.execQuery = (query, cb) => {
        setTimeout(() => cb(null, []), 0);
      };

      // First run, should get db connection then
      // block on the execQuery (see setTimeout above).
      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        utils.database.connection.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.false();
        mockedClient.getPipelineJobs.calledOnce.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(4);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Watchdog is already running, and will not run this time.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 0 executions that API thinks are running.`);
          entries[3].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });

      // Second run, should return without connecting.
      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        utils.database.connection.calledOnce.should.be.true();
      });
    });

    it('should still run without a callback', (done) => {
      mockedConnection.models.build.find.callsArgWith(1, null, []);
      mockedConnection.driver.execQuery.callsArgWith(1, null, []);
      mockedClient.getPipelineJobs.callsArgWith(0, null, []);

      actuators.watchdog.updateExecutionsFromConcourse();

      setTimeout(() => {
        utils.database.connection.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.false();
        mockedClient.getPipelineJobs.calledOnce.should.be.true();

        utils.logger.getEntriesForId('', (entries) => {
          // There won't be a testId for this one, we didn't pass in a logger.
          entries = _.filter(entries, e => e.message.indexOf('updateExecutionsFromConcourse') === 0);

          entries.length.should.equal(3);
          entries[0].message.should.equal(`updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`updateExecutionsFromConcourse : Found 0 executions that API thinks are running.`);
          entries[2].message.should.match(/updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      }, 0);
    });

    it('should not run if it cant get a db connection', (done) => {
      utils.database.connection.callsArgWith(0, new Error('no connection for you!'));

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        utils.database.connection.calledOnce.should.be.true();
        mockedConnection.models.build.find.called.should.be.false();
        mockedClient.getPipelineJobs.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(4);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Unable to get connection`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Error was encountered during watchdog flow: no connection for you!`);
          entries[3].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // In this test we take a single execution and have it not appear in the concourse running
    // jobs results. This means we should mark it as failed in API by creating an event for it,
    // and clearing the concourse_pipeline_id from the execution. We shouldn't attach any logs
    // from concourse, because the pipeline doesn't exist in concourse.
    it('should fail an execution if its corresponding pipeline is missing in concourse', (done) => {
      var mockedExecution = mockedRunningExecutions[0],
        mockedFailEvent = {
          artifact_id: null,
          save: sinon.stub().callsArgWith(0, null)
        };

      mockedConnection.driver.execQuery.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build.find.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build_step.create.callsArgWith(1, null, mockedFailEvent);
      mockedClient.getPipelineJobs.callsArgWith(0, null, []);

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedConnection.models.build_step.create.calledOnce.should.be.true();
        mockedConnection.models.build_step.find.called.should.be.false();
        actuators.artifacts.createArtifact.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(6);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 1 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 1.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 0 executions for pipeline b9e551c0-1876-11e6-b12c-09f468abd91c, did you delete it?`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 1 - Concourse pipeline status: Pipeline not found.`);
          entries[5].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // In this test we take a single execution and have it appear in the concourse jobs results as stopped.
    // It could have errored, or been aborted. In this situation we should mark the API execution as failed,
    // and leave the concourse_pipeline_id on it as the pipeline still exists. We should attach the concourse
    // logs to the build_step we added to the API execution.
    it('should fail an execution if its corresponding pipeline is stopped in concourse', (done) => {
      var mockedExecution = mockedRunningExecutions[1],
        mockedFailEvent = {
          artifact_id: null,
          save: sinon.stub().callsArgWith(0, null)
        };

      mockedConnection.driver.execQuery.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build.find.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build_step.create.callsArgWith(1, null, mockedFailEvent);
      mockedConnection.models.build_step.find.callsArgWith(1, null, [mockedFailEvent]);

      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);
      mockedClient.getPipelineLogs.callsArgWith(2, null, 'some logs');
      actuators.artifacts.createArtifact.callsArgWith(3, null, {});

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedConnection.models.build_step.create.calledOnce.should.be.true();
        mockedConnection.models.build_step.find.calledOnce.should.be.true();

        mockedClient.getPipelineJobs.calledOnce.should.be.true();
        mockedClient.getPipelineLogs.calledOnce.should.be.true();
        actuators.artifacts.createArtifact.calledOnce.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(5);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 1 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 2.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 2 - Concourse pipeline status: aborted.`);
          entries[4].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // In this test we take a single execution and have it first fail in concourse, and then re-appear as a running
    // pipeline. This means it shows up twice in the getPipelineJobs results, once as aborted and once as pending.
    // We should not fail this build, but let it run to add the events as normal. If this second execution also
    // fails or is aborted, the watchdog will clean this up on the next run through (see the next test).
    it('should not fail an execution if its corresponding pipeline is occurs multiple times in concourse with at least one still running', (done) => {
      var mockedExecution = mockedRunningExecutions[1],
        mockedFailEvent = {
          artifact_id: null,
          save: sinon.stub().callsArgWith(0, null)
        };

      // Simulate that someone stopped it and restarted it in Concourse directly
      mockedJobs = [{
        id: '931',
        pipeline: '987551c0-1876-11e6-b12c-09f468abd91c',
        job: 'start-job-in-pipeline',
        build: '108',
        status: 'aborted',
        start: '2016-05-11@16:31:18-0700',
        end: '2016-05-12@09:55:19-0700'
      }, {
        id: '939',
        pipeline: '987551c0-1876-11e6-b12c-09f468abd91c',
        job: 'start-job-in-pipeline',
        build: '102',
        status: 'pending',
        start: '2016-05-11@16:31:18-0700',
        end: '2016-05-12@09:55:19-0700'
      }];

      mockedConnection.driver.execQuery.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build.find.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build_step.create.callsArgWith(1, null, mockedFailEvent);
      mockedConnection.models.build_step.find.callsArgWith(1, null, [mockedFailEvent]);
      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedClient.getPipelineJobs.calledOnce.should.be.true();

        mockedConnection.models.build_step.create.called.should.be.false();
        mockedConnection.models.build_step.find.called.should.be.false();
        mockedClient.getPipelineLogs.called.should.be.false();
        actuators.artifacts.createArtifact.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(6);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 1 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 2.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 2 executions for pipeline 987551c0-1876-11e6-b12c-09f468abd91c, did you manually re-run it in concourse?`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : API execution 2 is still running in concourse, skipping.`);
          entries[5].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    it('should fail an execution if its corresponding pipeline is occurs multiple times in concourse', (done) => {
      var mockedExecution = mockedRunningExecutions[1],
        mockedFailEvent = {
          artifact_id: null,
          save: sinon.stub().callsArgWith(0, null)
        };

      // Simulate that someone stopped it and restarted it in Concourse directly
      mockedJobs = [{
        id: '931',
        pipeline: '987551c0-1876-11e6-b12c-09f468abd91c',
        job: 'start-job-in-pipeline',
        build: '108',
        status: 'aborted',
        start: '2016-05-11@16:31:18-0700',
        end: '2016-05-12@09:55:19-0700'
      }, {
        id: '939',
        pipeline: '987551c0-1876-11e6-b12c-09f468abd91c',
        job: 'start-job-in-pipeline',
        build: '102',
        status: 'aborted',
        start: '2016-05-11@16:31:18-0700',
        end: '2016-05-12@09:55:19-0700'
      }];

      mockedConnection.driver.execQuery.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build.find.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build_step.create.callsArgWith(1, null, mockedFailEvent);
      mockedConnection.models.build_step.find.callsArgWith(1, null, [mockedFailEvent]);

      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);
      mockedClient.getPipelineLogs.callsArgWith(2, null, 'some logs');
      actuators.artifacts.createArtifact.callsArgWith(3, null, {});

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedClient.getPipelineJobs.calledOnce.should.be.true();

        mockedConnection.models.build_step.create.calledOnce.should.be.true();
        mockedConnection.models.build_step.find.calledOnce.should.be.true();
        mockedClient.getPipelineLogs.calledOnce.should.be.true();
        actuators.artifacts.createArtifact.calledOnce.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(6);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 1 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 2.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 2 executions for pipeline 987551c0-1876-11e6-b12c-09f468abd91c, did you manually re-run it in concourse?`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 2 - Concourse pipeline status: aborted.`);
          entries[5].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // In this test we have a single execution which is pending and hasn't started running. The watchdog
    // shouldn't do anything, but should just let it run.
    it('should not fail an execution if its corresponding pipeline is pending in concourse', (done) => {
      var mockedExecution = mockedRunningExecutions[4];

      mockedConnection.driver.execQuery.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build.find.callsArgWith(1, null, [mockedExecution]);
      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedClient.getPipelineJobs.calledOnce.should.be.true();

        mockedConnection.models.build_step.create.called.should.be.false();
        mockedConnection.models.build_step.find.called.should.be.false();
        mockedClient.getPipelineLogs.called.should.be.false();
        actuators.artifacts.createArtifact.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(5);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 1 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 5.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : API execution 5 is still running in concourse, skipping.`);
          entries[4].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // In this test we have a single execution which is started and running. The watchdog
    // shouldn't do anything, but should just let it run.
    it('should not fail an execution if its corresponding pipeline is started in concourse', (done) => {
      var mockedExecution = mockedRunningExecutions[3];

      mockedConnection.driver.execQuery.callsArgWith(1, null, [mockedExecution]);
      mockedConnection.models.build.find.callsArgWith(1, null, [mockedExecution]);
      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedClient.getPipelineJobs.calledOnce.should.be.true();

        mockedConnection.models.build_step.create.called.should.be.false();
        mockedConnection.models.build_step.find.called.should.be.false();
        mockedClient.getPipelineLogs.called.should.be.false();
        actuators.artifacts.createArtifact.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(5);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 1 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 4.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : API execution 4 is still running in concourse, skipping.`);
          entries[4].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // ==== Fail Cases ====
    // In the following tests we want it to ignore individual errors when it cannot mark a pipeline
    // as failed. We do this, because returning the error will prevent the async.series from executing
    // the next tasks to fail other pipelines. It means that the watchdog will perpetually be 'stuck'.

    it('should ignore individual build_step save errors when trying to fail an execution', (done) => {
      var mockedFailEvent1, mockedFailEvent2;

      mockedRunningExecutions = [mockedRunningExecutions[0], mockedRunningExecutions[1]];
      mockedFailEvent1 = {
        artifact_id: null,
        save: sinon.stub()
      };
      mockedFailEvent2 = {
        artifact_id: null,
        save: sinon.stub()
      };

      mockedFailEvent1.save.callsArgWith(0, new Error('cannot save'));
      mockedFailEvent2.save.callsArgWith(0, null);

      mockedConnection.driver.execQuery.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build.find.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build_step.create.onFirstCall().callsArgWith(1, null, mockedFailEvent1);
      mockedConnection.models.build_step.create.onSecondCall().callsArgWith(1, null, mockedFailEvent2);
      mockedConnection.models.build_step.find.onFirstCall().callsArgWith(1, null, [mockedFailEvent1]);
      mockedConnection.models.build_step.find.onSecondCall().callsArgWith(1, null, [mockedFailEvent2]);

      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);
      mockedClient.getPipelineLogs.callsArgWith(2, null, 'some logs');
      actuators.artifacts.createArtifact.callsArgWith(3, null, {});

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedFailEvent1.save.calledOnce.should.be.true();
        mockedFailEvent2.save.calledOnce.should.be.true();

        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedConnection.models.build_step.create.calledTwice.should.be.true();
        mockedConnection.models.build_step.find.calledTwice.should.be.true();

        mockedClient.getPipelineJobs.calledOnce.should.be.true();
        mockedClient.getPipelineLogs.calledTwice.should.be.true();
        actuators.artifacts.createArtifact.calledTwice.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(7);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 2 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 1, 2.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 1 - Concourse pipeline status: errored.`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 2 - Concourse pipeline status: aborted.`);
          entries[5].message.should.equal(`${testId} : updateExecutionsFromConcourse : Unable to attach artifact logs for execution 1: cannot save`);
          entries[6].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    it('should ignore individual build_step find errors when trying to fail an execution', (done) => {
      var mockedFailEvent1, mockedFailEvent2;

      mockedRunningExecutions = [mockedRunningExecutions[0], mockedRunningExecutions[1]];

      mockedFailEvent1 = {
        artifact_id: null,
        save: sinon.stub()
      };
      mockedFailEvent2 = {
        artifact_id: null,
        save: sinon.stub()
      };

      mockedFailEvent1.save.callsArgWith(0, null);
      mockedFailEvent2.save.callsArgWith(0, null);

      mockedConnection.driver.execQuery.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build.find.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build_step.create.onFirstCall().callsArgWith(1, null, mockedFailEvent1);
      mockedConnection.models.build_step.create.onSecondCall().callsArgWith(1, null, mockedFailEvent2);
      mockedConnection.models.build_step.find.onFirstCall().callsArgWith(1, new Error('cannot find'), null);
      mockedConnection.models.build_step.find.onSecondCall().callsArgWith(1, null, [mockedFailEvent2]);

      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);
      mockedClient.getPipelineLogs.callsArgWith(2, null, 'some logs');
      actuators.artifacts.createArtifact.callsArgWith(3, null, {});

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedFailEvent1.save.called.should.be.false();
        mockedFailEvent2.save.calledOnce.should.be.true();

        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedConnection.models.build_step.create.calledTwice.should.be.true();
        mockedConnection.models.build_step.find.calledTwice.should.be.true();

        mockedClient.getPipelineJobs.calledOnce.should.be.true();
        mockedClient.getPipelineLogs.calledTwice.should.be.true();
        actuators.artifacts.createArtifact.calledTwice.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(7);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 2 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 1, 2.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 1 - Concourse pipeline status: errored.`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 2 - Concourse pipeline status: aborted.`);
          entries[5].message.should.equal(`${testId} : updateExecutionsFromConcourse : Unable to attach artifact logs for execution 1: cannot find`);
          entries[6].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // error on create build_step
    it('should ignore individual build_step create errors when trying to fail an execution', (done) => {
      var mockedFailEvent1, mockedFailEvent2;

      mockedRunningExecutions = [mockedRunningExecutions[0], mockedRunningExecutions[1]];

      mockedFailEvent1 = {
        artifact_id: null,
        save: sinon.stub()
      };
      mockedFailEvent2 = {
        artifact_id: null,
        save: sinon.stub()
      };

      mockedFailEvent1.save.callsArgWith(0, new Error('cannot save'));
      mockedFailEvent2.save.callsArgWith(0, null);

      mockedConnection.driver.execQuery.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build.find.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build_step.create.onFirstCall().callsArgWith(1, new Error('cannot create'));
      mockedConnection.models.build_step.create.onSecondCall().callsArgWith(1, null, mockedFailEvent2);
      mockedConnection.models.build_step.find.onFirstCall().callsArgWith(1, null, []); // didn't create, won't exist
      mockedConnection.models.build_step.find.onSecondCall().callsArgWith(1, null, [mockedFailEvent2]);

      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);
      mockedClient.getPipelineLogs.callsArgWith(2, null, 'some logs');
      actuators.artifacts.createArtifact.callsArgWith(3, null, {});

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedFailEvent1.save.called.should.be.false();
        mockedFailEvent2.save.calledOnce.should.be.true();

        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedConnection.models.build_step.create.calledTwice.should.be.true();
        mockedConnection.models.build_step.find.calledTwice.should.be.true();

        mockedClient.getPipelineJobs.calledOnce.should.be.true();
        mockedClient.getPipelineLogs.calledTwice.should.be.true();
        actuators.artifacts.createArtifact.calledTwice.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(8);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 2 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 1, 2.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 1 - Concourse pipeline status: errored.`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 2 - Concourse pipeline status: aborted.`);
          entries[5].message.should.equal(`${testId} : updateExecutionsFromConcourse : Unable to create build_step to fail 1`);
          entries[6].message.should.equal(`${testId} : updateExecutionsFromConcourse : Unable to attach artifact logs for execution 1: Expected to find a 'Pipeline Failed' event for execution 1.`)
          entries[7].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    it('should ignore individual build_step find being empty results when trying to fail an execution', (done) => {
      var mockedFailEvent1, mockedFailEvent2;

      mockedRunningExecutions = [mockedRunningExecutions[0], mockedRunningExecutions[1]];

      mockedFailEvent1 = {
        artifact_id: null,
        save: sinon.stub()
      };
      mockedFailEvent2 = {
        artifact_id: null,
        save: sinon.stub()
      };

      mockedFailEvent1.save.callsArgWith(0, new Error('cannot save'));
      mockedFailEvent2.save.callsArgWith(0, null);

      mockedConnection.driver.execQuery.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build.find.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build_step.create.onFirstCall().callsArgWith(1, null, mockedFailEvent1);
      mockedConnection.models.build_step.create.onSecondCall().callsArgWith(1, null, mockedFailEvent2);
      mockedConnection.models.build_step.find.onFirstCall().callsArgWith(1, null, []);
      mockedConnection.models.build_step.find.onSecondCall().callsArgWith(1, null, [mockedFailEvent2]);

      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);
      mockedClient.getPipelineLogs.callsArgWith(2, null, 'some logs');
      actuators.artifacts.createArtifact.callsArgWith(3, null, {});

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedFailEvent1.save.called.should.be.false();
        mockedFailEvent2.save.calledOnce.should.be.true();

        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedConnection.models.build_step.create.calledTwice.should.be.true();
        mockedConnection.models.build_step.find.calledTwice.should.be.true();

        mockedClient.getPipelineJobs.calledOnce.should.be.true();
        mockedClient.getPipelineLogs.calledTwice.should.be.true();
        actuators.artifacts.createArtifact.calledTwice.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(7);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 2 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 1, 2.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 1 - Concourse pipeline status: errored.`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 2 - Concourse pipeline status: aborted.`);
          entries[5].message.should.equal(`${testId} : updateExecutionsFromConcourse : Unable to attach artifact logs for execution 1: Expected to find a 'Pipeline Failed' event for execution 1.`);
          entries[6].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    it('should ignore individual build_step create errors when trying to fail an execution', (done) => {
      var mockedFailEvent1, mockedFailEvent2;

      // Save is only called when an execution is missing in concourse.
      mockedRunningExecutions = [mockedRunningExecutions[2], mockedRunningExecutions[1]];

      mockedFailEvent1 = {
        artifact_id: null,
        save: sinon.stub()
      };
      mockedFailEvent2 = {
        artifact_id: null,
        save: sinon.stub()
      };

      mockedFailEvent1.save.callsArgWith(0, null);
      mockedFailEvent2.save.callsArgWith(0, null);

      mockedConnection.driver.execQuery.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build.find.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build_step.create.onFirstCall().callsArgWith(1, null, mockedFailEvent1);
      mockedConnection.models.build_step.create.onSecondCall().callsArgWith(1, null, mockedFailEvent2);
      mockedConnection.models.build_step.find.onFirstCall().callsArgWith(1, null, [mockedFailEvent1]);

      // Trigger error saving the execution update
      mockedRunningExecutions[0].save.callsArgWith(0, new Error('cannot save'));

      mockedClient.getPipelineJobs.callsArgWith(0, null, mockedJobs);
      mockedClient.getPipelineLogs.callsArgWith(2, null, 'some logs');
      actuators.artifacts.createArtifact.callsArgWith(3, null, {});

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedFailEvent1.save.calledOnce.should.be.true();
        mockedFailEvent2.save.called.should.be.false();

        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedConnection.models.build_step.create.calledTwice.should.be.true();
        mockedConnection.models.build_step.find.calledOnce.should.be.true();

        mockedClient.getPipelineJobs.calledOnce.should.be.true();
        mockedClient.getPipelineLogs.calledOnce.should.be.true();
        actuators.artifacts.createArtifact.calledOnce.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(8);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 2 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 3, 2.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 0 executions for pipeline missing1-1876-11e6-b12c-09f468abd91c, did you delete it?`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 3 - Concourse pipeline status: Pipeline not found.`);
          entries[5].message.should.equal(`${testId} : updateExecutionsFromConcourse : Force failing execution 2 - Concourse pipeline status: aborted.`);
          entries[6].message.should.equal(`${testId} : updateExecutionsFromConcourse : Unable to clear the concourse_pipeline_id for execution 3: cannot save`);
          entries[7].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // get pipeline jobs fails
    it('should ignore individual build_step create errors when trying to fail an execution', (done) => {
      mockedConnection.driver.execQuery.callsArgWith(1, null, mockedRunningExecutions);
      mockedConnection.models.build.find.callsArgWith(1, null, mockedRunningExecutions);
      mockedClient.getPipelineJobs.callsArgWith(0, new Error('cannot get jobs'), null);

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.calledOnce.should.be.true();
        mockedClient.getPipelineJobs.calledOnce.should.be.true();

        mockedConnection.models.build_step.create.called.should.be.false();
        mockedConnection.models.build_step.find.called.should.be.false();
        mockedClient.getPipelineLogs.called.should.be.false();
        actuators.artifacts.createArtifact.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(6);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found 5 executions that API thinks are running.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Found executions: 1, 2, 3, 4, 5.`);
          entries[3].message.should.equal(`${testId} : updateExecutionsFromConcourse : Unable to get running pipelines.`);
          entries[4].message.should.equal(`${testId} : updateExecutionsFromConcourse : Error was encountered during watchdog flow: cannot get jobs`);
          entries[5].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });

    // get running executions fails
    it('should ignore individual build_step create errors when trying to fail an execution', (done) => {
      mockedConnection.driver.execQuery.callsArgWith(1, new Error('cannot get running executions'), null);

      actuators.watchdog.updateExecutionsFromConcourse(logger, () => {
        mockedConnection.driver.execQuery.calledOnce.should.be.true();
        mockedConnection.models.build.find.called.should.be.false();
        mockedClient.getPipelineJobs.called.should.be.false();

        mockedConnection.models.build_step.create.called.should.be.false();
        mockedConnection.models.build_step.find.called.should.be.false();
        mockedClient.getPipelineLogs.called.should.be.false();
        actuators.artifacts.createArtifact.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(4);
          entries[0].message.should.equal(`${testId} : updateExecutionsFromConcourse : Entering watchdog flow`);
          entries[1].message.should.equal(`${testId} : updateExecutionsFromConcourse : Unable to get pending executions.`);
          entries[2].message.should.equal(`${testId} : updateExecutionsFromConcourse : Error was encountered during watchdog flow: cannot get running executions`);
          entries[3].message.should.match(/[\w\-]* : updateExecutionsFromConcourse : Exiting watchdog flow, duration: \d+\.?\d* seconds\./g);
          return done();
        });
      });
    });
  });
});
