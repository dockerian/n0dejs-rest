var should = require('should'),
  sinon = require('sinon'),
  shell = require('shelljs'),
  uuid = require('uuid'),
  utils = require('../utils');

describe('utils/concourse/client', () => {
  var mockedConfig, mockedArguments;
  var client, testId;

  beforeEach(() => {
    shell.exec = sinon.stub();
    shell.exec.callsArgWith(2, 0, 'dummy output');

    mockedConfig = {
      apiUrl: 'https://api.concourse.com',
      username: 'ACONCUSER',
      password: 'APASSWORD'
    };

    mockedArguments = {};

    utils.logger.transports.console.level = 'silent';
    utils.logger.transports.buffer.level = 'debug';

    // Lets give each test a 'request-id' so we can query the logger for only those events.
    testId = uuid.v1();
    client = utils.concourse.client(utils.logger.shim(utils.logger, testId), mockedConfig);
  });

  it('should create client without args', () => {
    client = utils.concourse.client();
    should.exist(client.loginAndSync);
    should.exist(client.startPipeline);
    should.exist(client.abortPipeline);
    should.exist(client.destroyPipeline);
  });

  describe('loginAndSync', () => {
    it('works as a callback', (done) => {
      client.loginAndSync(done);
    });

    it('works as a promise', (done) => {
      client.loginAndSync().then(done);
    });

    it('works without auth', (done) => {
      delete mockedConfig.username;
      delete mockedConfig.password;

      client.loginAndSync(() => {
        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].level.should.equal('info');
          entries[0].message.should.equal(`${testId} : ConcourseClient : No basic auth configured`);

          entries[1].level.should.equal('info');
          entries[1].message.should.equal(`${testId} : ConcourseClient : Setting Concourse target`);
          shell.exec.firstCall.args[0].should.equal('fly login -t ConcourseInstance -c https://api.concourse.com');

          entries[2].level.should.equal('info');
          entries[2].message.should.equal(`${testId} : ConcourseClient : Syncing Concourse Client`);
          shell.exec.secondCall.args[0].should.equal('fly sync -t ConcourseInstance');

          entries[3].level.should.equal('info');
          entries[3].message.should.equal(`${testId} : ConcourseClient : Successfully logged in and syncronized the fly CLI`);

          shell.exec.calledTwice.should.be.true();
          entries.length.should.equal(4);
          done();
        });
      });
    });

    it('should reject promise on login failure', (done) => {
      shell.exec = sinon.stub();
      shell.exec.onFirstCall().callsArgWith(2, 1, 'bad login');
      shell.exec.onSecondCall().callsArgWith(2, 1, 'bad sync');

      client.loginAndSync().catch(() => {
        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].level.should.equal('info');
          entries[0].message.should.equal(`${testId} : ConcourseClient : Setting Concourse target`);
          shell.exec.firstCall.args[0].should.equal('fly login -t ConcourseInstance -u ACONCUSER -p APASSWORD -c https://api.concourse.com');

          entries[1].level.should.equal('error');
          entries[1].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Setting Concourse target" returned non zero response with output:  bad login`);

          entries[2].level.should.equal('error');
          entries[2].message.should.equal(`${testId} : ConcourseClient : Failed login and sync of the Fly CLI`);

          shell.exec.calledOnce.should.be.true();
          entries.length.should.equal(3);
          done();
        });
      });
    });

    it('should reject promise on sync failure', (done) => {
      shell.exec = sinon.stub();
      shell.exec.onFirstCall().callsArgWith(2, 0, 'yay');
      shell.exec.onSecondCall().callsArgWith(2, 1, 'bad sync');

      client.loginAndSync().catch(() => {
        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].level.should.equal('info');
          entries[0].message.should.equal(`${testId} : ConcourseClient : Setting Concourse target`);
          shell.exec.firstCall.args[0].should.equal('fly login -t ConcourseInstance -u ACONCUSER -p APASSWORD -c https://api.concourse.com');

          entries[1].level.should.equal('info');
          entries[1].message.should.equal(`${testId} : ConcourseClient : Syncing Concourse Client`);
          shell.exec.secondCall.args[0].should.equal('fly sync -t ConcourseInstance');

          entries[2].level.should.equal('error');
          entries[2].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Syncing Concourse Client" returned non zero response with output:  bad sync`);

          entries[3].level.should.equal('error');
          entries[3].message.should.equal(`${testId} : ConcourseClient : Failed login and sync of the Fly CLI`);

          shell.exec.calledTwice.should.be.true();
          entries.length.should.equal(4);
          done();
        });
      });
    });

    it('should call a callback with err if anything goes wrong', (done) => {
      shell.exec = sinon.stub();
      shell.exec.onFirstCall().callsArgWith(2, 0, 'yay');
      shell.exec.onSecondCall().callsArgWith(2, 1, 'bad sync');

      client.loginAndSync((err) => {
        should.exist(err);
        should.exist(err.message);
        err.message.should.equal('Failed: Syncing Concourse Client');

        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].level.should.equal('info');
          entries[0].message.should.equal(`${testId} : ConcourseClient : Setting Concourse target`);
          shell.exec.firstCall.args[0].should.equal('fly login -t ConcourseInstance -u ACONCUSER -p APASSWORD -c https://api.concourse.com');

          entries[1].level.should.equal('info');
          entries[1].message.should.equal(`${testId} : ConcourseClient : Syncing Concourse Client`);
          shell.exec.secondCall.args[0].should.equal('fly sync -t ConcourseInstance');

          entries[2].level.should.equal('error');
          entries[2].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Syncing Concourse Client" returned non zero response with output:  bad sync`);

          entries[3].level.should.equal('error');
          entries[3].message.should.equal(`${testId} : ConcourseClient : Failed login and sync of the Fly CLI`);

          shell.exec.calledTwice.should.be.true();
          entries.length.should.equal(4);
          done();
        });
      });
    });
  });

  describe('startPipeline', () => {
    it('should start pipeline without args', (done) => {
      client.startPipeline('MyPipeline', 'the/pipeline/definition.yml', mockedArguments,
        (err) => {
          should.not.exist(err);

          utils.logger.getEntriesForId(testId, (entries) => {
            entries[0].level.should.equal('info');
            entries[0].message.should.equal(`${testId} : ConcourseClient : Creating pipeline in concourse`);
            shell.exec.firstCall.args[0].should.equal(
              'fly set-pipeline -t ConcourseInstance -n -c the/pipeline/definition.yml -p MyPipeline ');

            entries[1].level.should.equal('info');
            entries[1].message.should.equal(`${testId} : ConcourseClient : Unpausing pipeline in concourse`);
            shell.exec.calledWith('fly unpause-pipeline -t ConcourseInstance -p MyPipeline').should.be.true();

            entries[2].level.should.equal('info');
            entries[2].message.should.equal(`${testId} : ConcourseClient : Starting pipeline in concourse`);
            shell.exec.calledWith('fly -t ConcourseInstance trigger-job --job MyPipeline/start-job-in-pipeline').should.be.true();

            entries[3].level.should.equal('info');
            entries[3].message.should.equal(`${testId} : ConcourseClient : Successfully started pipeline: MyPipeline`);

            entries.length.should.equal(4);
            shell.exec.calledThrice.should.be.true();
            done();
          });
        });
    });

    it('should start pipeline with args', (done) => {
      mockedArguments.foo_build_id = 12;
      mockedArguments.some_arg = 'myval';

      client.startPipeline('MyPipeline', 'the/pipeline/definition.yml', mockedArguments,
        (err) => {
          should.not.exist(err);

          utils.logger.getEntriesForId(testId, (entries) => {
            entries[0].level.should.equal('info');
            entries[0].message.should.equal(`${testId} : ConcourseClient : Creating pipeline in concourse`);
            shell.exec.firstCall.args[0].should.equal(
              'fly set-pipeline -t ConcourseInstance -n -c the/pipeline/definition.yml -p MyPipeline --var "foo_build_id=12" --var "some_arg=myval"');

            entries[1].level.should.equal('info');
            entries[1].message.should.equal(`${testId} : ConcourseClient : Unpausing pipeline in concourse`);
            shell.exec.secondCall.args[0].should.equal('fly unpause-pipeline -t ConcourseInstance -p MyPipeline');

            entries[2].level.should.equal('info');
            entries[2].message.should.equal(`${testId} : ConcourseClient : Starting pipeline in concourse`);
            shell.exec.thirdCall.args[0].should.equal('fly -t ConcourseInstance trigger-job --job MyPipeline/start-job-in-pipeline');

            entries[3].level.should.equal('info');
            entries[3].message.should.equal(`${testId} : ConcourseClient : Successfully started pipeline: MyPipeline`);

            entries.length.should.equal(4);
            shell.exec.calledThrice.should.be.true();
            done();
          });
        });
    });

    it('should return errors when start pipeline fails', (done) => {
      // We only want the start pipeline to throw errors, not the login step.
      shell.exec = sinon.stub();
      shell.exec.withArgs('fly set-pipeline -t ConcourseInstance -n -c the/pipeline/definition.yml -p MyPipeline ').callsArgWith(2, 1, 'bad start :(');
      shell.exec.callsArgWith(2, 0, '');

      client.startPipeline('MyPipeline', 'the/pipeline/definition.yml', mockedArguments,
        (err) => {
          should.exist(err);
          should.exist(err.message);
          err.message.should.equal('Failed: Creating pipeline in concourse');

          utils.logger.getEntriesForId(testId, (entries) => {
            entries.length.should.equal(10);
            entries[0].level.should.equal('info');
            entries[0].message.should.equal(`${testId} : ConcourseClient : Creating pipeline in concourse`);
            shell.exec.firstCall.args[0].should.equal(
              'fly set-pipeline -t ConcourseInstance -n -c the/pipeline/definition.yml -p MyPipeline ');

            entries[1].level.should.equal('error');
            entries[1].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Creating pipeline in concourse" returned non zero response with output:  bad start :(`);

            entries[2].level.should.equal('info');
            entries[2].message.should.equal(`${testId} : ConcourseClient : Login and retry task: Creating pipeline in concourse`);

            entries[3].level.should.equal('info');
            entries[3].message.should.equal(`${testId} : ConcourseClient : Setting Concourse target`);

            entries[4].level.should.equal('info');
            entries[4].message.should.equal(`${testId} : ConcourseClient : Syncing Concourse Client`);

            entries[5].level.should.equal('info');
            entries[5].message.should.equal(`${testId} : ConcourseClient : Successfully logged in and syncronized the fly CLI`);

            entries[6].level.should.equal('info');
            entries[6].message.should.equal(`${testId} : ConcourseClient : Retrying task: Creating pipeline in concourse`);

            entries[7].level.should.equal('info');
            entries[7].message.should.equal(`${testId} : ConcourseClient : Creating pipeline in concourse`);

            entries[8].level.should.equal('error');
            entries[8].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Creating pipeline in concourse" returned non zero response with output:  bad start :(`);

            entries[9].level.should.equal('error');
            entries[9].message.should.equal(`${testId} : ConcourseClient : Failed starting pipeline`);

            done();
          });
        });
    });
  });

  describe('abortPipeline', () => {
    it('should abort pipeline', (done) => {
      client.abortPipeline('MyPipeline', 3, (err) => {
        should.not.exist(err);

        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].level.should.equal('info');
          entries[0].message.should.equal(`${testId} : ConcourseClient : Aborting build with id 3 in pipeline : MyPipeline`);
          shell.exec.firstCall.args[0].should.equal(
            'fly -t ConcourseInstance abort-build --job MyPipeline/start-job-in-pipeline --build 3');

          entries[1].level.should.equal('info');
          entries[1].message.should.equal(`${testId} : ConcourseClient : Successfully aborted pipeline: MyPipeline`);

          entries.length.should.equal(2);
          shell.exec.calledOnce.should.be.true();
          done();
        });
      });
    });

    it('should return errors when abort pipeline fails', (done) => {
      // We only want the abort pipeline to throw errors, not the login step.
      shell.exec = sinon.stub();
      shell.exec.withArgs('fly -t ConcourseInstance abort-build --job MyPipeline/start-job-in-pipeline --build 3').callsArgWith(2, 1, null);
      shell.exec.callsArgWith(2, 0, '');

      client.abortPipeline('MyPipeline', 3, (err) => {
        should.exist(err);
        should.exist(err.message);
        err.message.should.equal('Failed: Aborting build with id 3 in pipeline : MyPipeline');

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(10);
          entries[0].level.should.equal('info');
          entries[0].message.should.equal(`${testId} : ConcourseClient : Aborting build with id 3 in pipeline : MyPipeline`);
          shell.exec.firstCall.args[0].should.equal(
            'fly -t ConcourseInstance abort-build --job MyPipeline/start-job-in-pipeline --build 3');

          entries[1].level.should.equal('error');
          entries[1].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Aborting build with id 3 in pipeline : MyPipeline" returned non zero response with output:  <not provided>`);

          entries[2].level.should.equal('info');
          entries[2].message.should.equal(`${testId} : ConcourseClient : Login and retry task: Aborting build with id 3 in pipeline : MyPipeline`);

          entries[3].level.should.equal('info');
          entries[3].message.should.equal(`${testId} : ConcourseClient : Setting Concourse target`);

          entries[4].level.should.equal('info');
          entries[4].message.should.equal(`${testId} : ConcourseClient : Syncing Concourse Client`);

          entries[5].level.should.equal('info');
          entries[5].message.should.equal(`${testId} : ConcourseClient : Successfully logged in and syncronized the fly CLI`);

          entries[6].level.should.equal('info');
          entries[6].message.should.equal(`${testId} : ConcourseClient : Retrying task: Aborting build with id 3 in pipeline : MyPipeline`);

          entries[7].level.should.equal('info');
          entries[7].message.should.equal(`${testId} : ConcourseClient : Aborting build with id 3 in pipeline : MyPipeline`);

          entries[8].level.should.equal('error');
          entries[8].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Aborting build with id 3 in pipeline : MyPipeline" returned non zero response with output:  <not provided>`);

          entries[9].level.should.equal('error');
          entries[9].message.should.equal(`${testId} : ConcourseClient : Failed aborting pipeline: MyPipeline`);
          done();
        });
      });
    });
  });

  describe('destroyPipeline', () => {
    it('should destroy a pipeline', (done) => {
      client.destroyPipeline('MyPipeline', (err) => {
        should.not.exist(err);

        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].level.should.equal('info');
          entries[0].message.should.equal(`${testId} : ConcourseClient : Destroying pipeline with id MyPipeline`);
          shell.exec.firstCall.args[0].should.equal('yes y | fly -t ConcourseInstance destroy-pipeline -p MyPipeline');

          entries[1].level.should.equal('info');
          entries[1].message.should.equal(`${testId} : ConcourseClient : Successfully destroyed pipeline: MyPipeline`);

          entries.length.should.equal(2);
          shell.exec.calledOnce.should.be.true();
          done();
        });
      });
    });

    it('should return errors when destroy pipeline fails', (done) => {
      // We only want the destroy pipeline to throw errors, not the login step.
      shell.exec = sinon.stub();
      shell.exec.withArgs('yes y | fly -t ConcourseInstance destroy-pipeline -p MyPipeline').callsArgWith(2, 1, null);
      shell.exec.callsArgWith(2, 0, '');

      client.destroyPipeline('MyPipeline', (err) => {
        should.exist(err);
        should.exist(err.message);
        err.message.should.equal('Failed: Destroying pipeline with id MyPipeline');

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(10);
          entries[0].level.should.equal('info');
          entries[0].message.should.equal(`${testId} : ConcourseClient : Destroying pipeline with id MyPipeline`);
          shell.exec.firstCall.args[0].should.equal('yes y | fly -t ConcourseInstance destroy-pipeline -p MyPipeline');

          entries[1].level.should.equal('error');
          entries[1].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Destroying pipeline with id MyPipeline" returned non zero response with output:  <not provided>`);

          entries[2].level.should.equal('info');
          entries[2].message.should.equal(`${testId} : ConcourseClient : Login and retry task: Destroying pipeline with id MyPipeline`);

          entries[3].level.should.equal('info');
          entries[3].message.should.equal(`${testId} : ConcourseClient : Setting Concourse target`);

          entries[4].level.should.equal('info');
          entries[4].message.should.equal(`${testId} : ConcourseClient : Syncing Concourse Client`);

          entries[5].level.should.equal('info');
          entries[5].message.should.equal(`${testId} : ConcourseClient : Successfully logged in and syncronized the fly CLI`);

          entries[6].level.should.equal('info');
          entries[6].message.should.equal(`${testId} : ConcourseClient : Retrying task: Destroying pipeline with id MyPipeline`);

          entries[7].level.should.equal('info');
          entries[7].message.should.equal(`${testId} : ConcourseClient : Destroying pipeline with id MyPipeline`);

          entries[8].level.should.equal('error');
          entries[8].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Destroying pipeline with id MyPipeline" returned non zero response with output:  <not provided>`);

          entries[9].level.should.equal('error');
          entries[9].message.should.equal(`${testId} : ConcourseClient : Failed destroying pipeline: MyPipeline`);
          done();
        });
      });
    });
  });

  describe('getPipelineJobs', () => {
    it('should get pipeline jobs', (done) => {
      var pipelines = `
945  b9e551c0-1876-11e6-b12c-09f468abd91c/start-job-in-pipeline  1      errored    2016-05-12@12:21:46-0700  2016-05-12@12:22:21-0700  35s
944  prod/deploy-to-integration-environment-ucp                  112    succeeded  2016-05-12@12:04:13-0700  2016-05-12@12:31:19-0700  27m6s
943  prod/deploy-to-integration-environment-ucp                  111    failed     2016-05-12@11:28:53-0700  2016-05-12@12:01:37-0700  32m44s
931  prod/deploy-to-integration-environment-ucp                  108    aborted    2016-05-11@16:31:18-0700  2016-05-12@09:55:19-0700  17h24m1s
919  prod/foo-functional-tests: build and publish                23     succeeded  2016-05-11@13:55:41-0700  2016-05-11@14:05:40-0700  9m59s`;

      shell.exec.callsArgWith(2, 0, pipelines);
      client.getPipelineJobs((err, jobs) => {
        should.not.exist(err);
        should.exist(jobs);

        jobs.length.should.equal(5);
        // an API pipeline
        jobs[0].pipeline.should.equal('b9e551c0-1876-11e6-b12c-09f468abd91c');
        jobs[0].job.should.equal('start-job-in-pipeline');
        jobs[0].status.should.equal('errored');

        // various status types
        jobs[1].status.should.equal('succeeded');
        jobs[2].status.should.equal('failed');
        jobs[3].status.should.equal('aborted');

        // a random other pipeline with spaces in name, should still parse correctly
        jobs[4].pipeline.should.equal('prod');
        jobs[4].job.should.equal('foo-functional-tests: build and publish');
        jobs[4].status.should.equal('succeeded');

        return done();
      });
    });

    it('should callback with an error if the CLI fails', (done) => {
      // We only want the destroy pipeline to throw errors, not the login step.
      shell.exec = sinon.stub();
      shell.exec.withArgs('fly -t ConcourseInstance builds').callsArgWith(2, 1, 'ERROR UNABLE TO GET PIPELINES');
      shell.exec.callsArgWith(2, 0, '');

      client.getPipelineJobs((err, jobs) => {
        should.exist(err);
        should.not.exist(jobs);

        err.should.be.an.instanceof(Error);
        err.message.should.equal('Failed: Getting pipelines from concourse');

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(10);
          entries[0].message.should.equal(`${testId} : ConcourseClient : Getting pipelines from concourse`);
          entries[1].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Getting pipelines from concourse" returned non zero response with output:  ERROR UNABLE TO GET PIPELINES`);
          entries[2].message.should.equal(`${testId} : ConcourseClient : Login and retry task: Getting pipelines from concourse`);
          entries[3].message.should.equal(`${testId} : ConcourseClient : Setting Concourse target`);
          entries[4].message.should.equal(`${testId} : ConcourseClient : Syncing Concourse Client`);
          entries[5].message.should.equal(`${testId} : ConcourseClient : Successfully logged in and syncronized the fly CLI`);
          entries[6].message.should.equal(`${testId} : ConcourseClient : Retrying task: Getting pipelines from concourse`);
          entries[7].message.should.equal(`${testId} : ConcourseClient : Getting pipelines from concourse`);
          entries[8].message.should.equal(`${testId} : ConcourseClient : Executing fly command "Getting pipelines from concourse" returned non zero response with output:  ERROR UNABLE TO GET PIPELINES`);
          entries[9].message.should.equal(`${testId} : ConcourseClient : Couldn't get pipelines`);
          return done();
        });
      });
    });
  });

  describe('getPipelineLogs', () => {
    it('should be able to fetch a log', (done) => {
      shell.exec.callsArgWith(2, 0, 'this is some log text content and stuff');

      client.getPipelineLogs('b9e551c0-1876-11e6-b12c-09f468abd91c', 'start-job-in-pipeline', (err, logs) => {
        should.not.exist(err);
        should.exist(logs);

        logs.should.equal('this is some log text content and stuff');
        shell.exec.calledTwice.should.be.true();
        shell.exec.calledWith('fly -t ConcourseInstance get-pipeline -p b9e551c0-1876-11e6-b12c-09f468abd91c').should.be.true();
        shell.exec.calledWith('fly -t ConcourseInstance watch -j b9e551c0-1876-11e6-b12c-09f468abd91c/start-job-in-pipeline -b1; echo "done";').should.be.true();

        return done();
      });
    });

    it('should never return an empty log', (done) => {
      shell.exec.callsArgWith(2, 0, '');

      client.getPipelineLogs('b9e551c0-1876-11e6-b12c-09f468abd91c', 'start-job-in-pipeline', (err, logs) => {
        should.not.exist(err);
        should.exist(logs);

        logs.should.equal('NO OUTPUT RETURNED FROM CONCOURSE');
        shell.exec.calledTwice.should.be.true();
        shell.exec.calledWith('fly -t ConcourseInstance get-pipeline -p b9e551c0-1876-11e6-b12c-09f468abd91c').should.be.true();
        shell.exec.calledWith('fly -t ConcourseInstance watch -j b9e551c0-1876-11e6-b12c-09f468abd91c/start-job-in-pipeline -b1; echo "done";').should.be.true();

        return done();
      });
    });

    it('should handle errors syncing fly when CLI gets logs', (done) => {
      shell.exec.callsArgWith(2, 5, 'error text done');

      client.getPipelineLogs('b9e551c0-1876-11e6-b12c-09f468abd91c', 'start-job-in-pipeline', (err, logs) => {
        should.exist(err);
        err.message.should.be.equal('Failed: Getting pipeline from concourse')
        shell.exec.calledTwice.should.be.true();
        shell.exec.calledWith('fly -t ConcourseInstance get-pipeline -p b9e551c0-1876-11e6-b12c-09f468abd91c').should.be.true();
        shell.exec.calledWith('fly -t ConcourseInstance watch -j b9e551c0-1876-11e6-b12c-09f468abd91c/start-job-in-pipeline -b1; echo "done";').should.be.false();
        return done();
      });
    });

    it('should append echo "done" to prevent non-zero exit code when CLI gets logs', (done) => {
      shell.exec.callsArgWith(2, 0, 'error text done');

      client.getPipelineLogs('b9e551c0-1876-11e6-b12c-09f468abd91c', 'start-job-in-pipeline', (err, logs) => {
        should.not.exist(err);
        shell.exec.calledTwice.should.be.true();
        shell.exec.calledWith('fly -t ConcourseInstance get-pipeline -p b9e551c0-1876-11e6-b12c-09f468abd91c').should.be.true();
        shell.exec.calledWith('fly -t ConcourseInstance watch -j b9e551c0-1876-11e6-b12c-09f468abd91c/start-job-in-pipeline -b1; echo "done";').should.be.true();
        return done();
      });
    });
  });
});
