var _ = require('lodash'),
  async = require('async'),
  q = require('q'),
  shell = require('shelljs'),
  utils = require('../index.js');

module.exports = function ConcourseClient(logger, settings) {
  settings = settings || utils.settings.concourse;
  logger = logger || utils.logger;

  settings.concourseInstanceName = 'ConcourseInstance';
  logger = utils.logger.shim(logger, 'ConcourseClient');

  return {
    loginAndSync: loginAndSync,
    startPipeline: startPipeline,
    abortPipeline: abortPipeline,
    destroyPipeline: destroyPipeline,
    getPipelineJobs: getPipelineJobs,
    getPipelineLogs: getPipelineLogs
  };

  function loginAndSync(done) {
    var setConcourseTargetCommand, syncFlyCLICommand, promise;

    // If we didn't get a callback, then we should return a promise;
    if (typeof arguments[0] !== 'function') {
      var deferred = q.defer();
      promise = deferred.promise;

      done = (err) => {
        if (err) {
          deferred.reject(err);
        } else {
          deferred.resolve();
        }
      }
    }

    // add the commands to target the concourse server instance and sync the CLI.
    setConcourseTargetCommand = {
      message: 'Setting Concourse target',
      command: `fly login -t ${settings.concourseInstanceName} -u ${settings.username} -p ${settings.password} -c ${settings.apiUrl}`
    };

    if (!settings.username && !settings.password) {
      logger.info('No basic auth configured');
      setConcourseTargetCommand.command = `fly login -t ${settings.concourseInstanceName} -c ${settings.apiUrl}`;
    }

    syncFlyCLICommand = {
      message: 'Syncing Concourse Client',
      command: `fly sync -t ${settings.concourseInstanceName}`
    };

    async.eachSeries([
      setConcourseTargetCommand,
      syncFlyCLICommand
    ], executeFlyCommand, (err) => {
      if (err) {
        logger.error('Failed login and sync of the Fly CLI', err);
        return done(err);
      }

      logger.info('Successfully logged in and syncronized the fly CLI');
      return done();
    });

    return promise;
  }

  function startPipeline(pipelineId, templatePath, templateArgs, done) {
    var argumentString, createPipelineCommand,
      unpausePipelineCommand, triggerBuildCommand;

    // create the argument string for the pipeline arguments.
    argumentString = generateArgumentString(templateArgs);

    // yes y | fly set-pipeline -c ../pipelines/pullrequestopened.yml -p <pipelineId> --var 'a=1' --var 'b=2'
    createPipelineCommand = {
      message: 'Creating pipeline in concourse',
      command: `fly set-pipeline -t ${settings.concourseInstanceName} -n -c ${templatePath} -p ${pipelineId} ${argumentString}`
    };

    // fly unpause-pipeline -p <pipelineId>
    unpausePipelineCommand = {
      message: 'Unpausing pipeline in concourse',
      command: `fly unpause-pipeline -t ${settings.concourseInstanceName} -p ${pipelineId}`
    };

    //  fly -t example trigger-job --job my-pipeline/my-job
    triggerBuildCommand = {
      message: 'Starting pipeline in concourse',
      command: `fly -t ${settings.concourseInstanceName} trigger-job --job ${pipelineId}/${utils.constants.Concourse.JobName}`
    };

    async.eachSeries([
      createPipelineCommand,
      unpausePipelineCommand,
      triggerBuildCommand
    ], executeFlyCommandWithRetry, (err) => {
      if (err) {
        logger.error('Failed starting pipeline', err);
        return done(err);
      }

      logger.info(`Successfully started pipeline: ${pipelineId}`);
      return done();
    });
  }

  function abortPipeline(pipelineId, executionId, done) {
    var abortPipelineCommand = {
      message: `Aborting build with id ${executionId} in pipeline : ${pipelineId}`,
      command: `fly -t ${settings.concourseInstanceName} abort-build --job ${pipelineId}/${utils.constants.Concourse.JobName} --build ${executionId}`
    };

    executeFlyCommandWithRetry(abortPipelineCommand, (err) => {
      if (err) {
        logger.error(`Failed aborting pipeline: ${pipelineId}`, err);
        return done(err);
      }

      logger.info(`Successfully aborted pipeline: ${pipelineId}`);
      return done();
    });
  }

  function destroyPipeline(pipelineId, done) {
    var destroyPipelineCommand = {
      message: `Destroying pipeline with id ${pipelineId}`,
      command: `yes y | fly -t ${settings.concourseInstanceName} destroy-pipeline -p ${pipelineId}`
    };

    executeFlyCommandWithRetry(destroyPipelineCommand, (err) => {
      if (err) {
        logger.error(`Failed destroying pipeline: ${pipelineId}`, err);
        return done(err);
      }

      logger.info(`Successfully destroyed pipeline: ${pipelineId}`);
      return done();
    });
  }

  function getPipelineJobs(done) {
    var getPipelineJobsCommand = {
      message: 'Getting pipelines from concourse',
      command: `fly -t ${settings.concourseInstanceName} builds`
    };

    return executeFlyCommandWithRetry(getPipelineJobsCommand, (err, output) => {
      var jobs = [],
        rows;

      if (err) {
        logger.warn('Couldn\'t get pipelines');
        return done(err);
      }

      // We expect a set of rows to be returned, an example is as follows:
      //id   pipeline/job                                                build  status     start                     end                       duration
      //950  prod/integration-tests-ucp                                  69     failed     2016-05-12@14:04:09-0700  2016-05-12@14:22:21-0700  18m12s
      rows = output.split('\n');

      _.forEach(rows, (row) => {
        row = row.split(/[\s]{2,}/);
        if (row.length < 7) {
          // ignore empty/invalid rows
          return;
        }

        jobs.push({
          id: row[0],
          pipeline: row[1].split('\/')[0],
          job: row[1].split('\/')[1],
          build: row[2],
          status: row[3],
          start: row[4],
          end: row[5]
        });
      });

      return done(null, jobs);
    });
  }

  function getPipelineLogs(pipeline, job, done) {

    var getPipelineCommand = {
      message: 'Getting pipeline from concourse',
      command: `fly -t ${settings.concourseInstanceName} get-pipeline -p ${pipeline}`
    };

    var getPipelineLogsCommand = {
      message: 'Getting logs for pipeline from concourse',
      command: `fly -t ${settings.concourseInstanceName} watch -j ${pipeline}/${job} -b1`
    };

    async.waterfall([
      function getPipeline(callback) {
        // The fly CLI returns the logs and exits with a non-zero exit code if the build failed.
        // We're unable to figure out if the non-zero exit code is because the build failed
        // or if we're unable to talk to the Concourse instance.
        // To help identify issues with the connection to Concourse,
        // We first get the pipeline from Concourse server which should cause the
        // client to reconnect if the connection has failed.
        executeFlyCommandWithRetry(getPipelineCommand, callback);
      },
      function getPipelineLogs(pipeline, callback) {
        // Once we've ensured that the connection to the Concourse Instance is working,
        // We then try to get logs and return a dummy exit code.
        // This ensures that any errors are because of the fly cli parroting the
        // exit code of the job in Concourse and not because of connection failures.
        getPipelineLogsCommand.command += '; echo "done";'
        executeFlyCommandWithRetry(getPipelineLogsCommand, callback);
      }
    ], (err, log) => {
      if (err) {
        return done(err);
      }

      if (!log || log === '') {
        logger.warn(`Empty logs returned from concourse for pipeline ${pipeline}/${job}`);
        log = 'NO OUTPUT RETURNED FROM CONCOURSE';
      }

      return done(null, log);
    });
  }

  function generateArgumentString(options) {
    // {a:1, b:2}
    // will be converted to
    // --var 'a=1' --var 'b=2'
    var args = [];
    for (propertyName in options) {
      args.push(`--var "${propertyName}=${options[propertyName]}"`);
    }
    return args.join(' ');
  }

  function executeFlyCommandWithRetry(task, done) {
    executeFlyCommand(task, (err, output) => {
      if (err) {
        logger.info(`Login and retry task: ${task.message}`);
        return loginAndSync((loginErr) => {
          if (loginErr) {
            // Return the error relating to the original command.
            // LoginAndSync is responsible for printing its errors to logs.
            return done(err);
          }

          logger.info(`Retrying task: ${task.message}`);
          executeFlyCommand(task, done);
        });
      }

      return done(null, output);
    });
  }

  function executeFlyCommand(task, done) {
    logger.info(task.message);
    shell.exec(task.command, {
      silent: true
    }, (code, output) => {
      if (code === 0) {
        return done(null, output);
      }

      var err = new Error(`Failed: ${task.message}`);
      logger.error(`Executing fly command "${task.message}" returned non zero response with output: `, output || '<not provided>');
      return done(err, output);
    });
  }
};
