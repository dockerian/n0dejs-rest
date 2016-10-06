var _ = require('lodash'),
  async = require('async'),
  fs = require('fs'),
  uuid = require('uuid'),
  actuators = require('../actuators'),
  utils = require('../../utils'),
  isRunning = false;

exports.updateExecutionsFromConcourse = function updateExecutionsFromConcourse(logger, done) {
  var connection, apiExecutions, concourseExecutions, startTime = Date.now();

  done = done || function () {};
  logger = utils.logger.shim(logger || utils.logger, 'updateExecutionsFromConcourse');

  if (isRunning) {
    logger.warn('Watchdog is already running, and will not run this time.');
    return done();
  }

  logger.debug(`Entering watchdog flow`);
  isRunning = true;

  return async.series([
    getConnection,
    getRunningExecutions,
    getRunningPipelines,
    updateExecutions
  ], (err) => {
    if (err) {
      logger.warn(`Error was encountered during watchdog flow: ${err.message}`);
    }

    logger.debug(`Exiting watchdog flow, duration: ${(Date.now() - startTime) / 1000} seconds.`);
    isRunning = false;

    return done(err);
  });

  function getConnection(callback) {
    utils.database.connection((err, conn) => {
      if (err) {
        logger.debug('Unable to get connection');
      }

      connection = conn;
      return callback(err);
    });
  }

  function getRunningExecutions(callback) {
    // Halted builds will either have a failed event, or a successful 'Pipeline Completed' event.
    var getapiExecutionsQuery = `
      SELECT DISTINCT id
      FROM build
      WHERE NOT EXISTS (
        SELECT build_id FROM build_step
          WHERE (
            build_step.type = '${utils.constants.Status.PipelineCompleted}'
            OR build_step.state = 'failed'
          )
          AND build_step.build_id = build.id
        );`;

    connection.driver.execQuery(getapiExecutionsQuery, (err, results) => {
      var buildIds;
      if (err) {
        logger.debug('Unable to get pending executions.');
        return callback(err);
      }

      buildIds = _.map(results, 'id');
      logger.debug(`Found ${buildIds.length} executions that API thinks are running.`);

      if (!buildIds.length) {
        // no running builds
        return callback();
      }

      logger.debug(`Found executions: ${buildIds.join(', ')}.`);
      connection.models.build.find({
        id: buildIds
      }, (err, builds) => {
        apiExecutions = builds || [];
        return callback(err);
      });
    });
  }

  function getRunningPipelines(callback) {
    utils.concourse.client(logger).getPipelineJobs((err, jobs) => {
      if (err) {
        logger.debug('Unable to get running pipelines.');
      }

      concourseExecutions = jobs;
      return callback(err);
    });
  }

  function updateExecutions(callback) {
    var concourseExecution,
      tasks = [];

    // Get the concourse execution state for each execution
    // that API thinks is running. Check to see if its still
    // running in concourse - if it isn't update the API db
    // instance. If it is, check to see if it's timed out.
    _.each(apiExecutions, (apiExecution) => {
      concourseExecution = _.filter(concourseExecutions, {
        pipeline: apiExecution.concourse_pipeline_id,
        job: utils.constants.Concourse.JobName
      });

      // The result of the filter will be an array with matched executions in it.
      // we only expect 1 match, but there may be none if the pipeline is no longer
      // in concourse, or more if the pipeline was manually re-started in concourse.
      if (concourseExecution.length !== 1) {
        logger.warn(`Found ${concourseExecution.length} executions for pipeline ` +
          `${apiExecution.concourse_pipeline_id}, ` +
          `${concourseExecution.length === 0 ? 'did you delete it?' : 'did you manually re-run it in concourse?'}`);

        // If there are multiple results, and at least one of them is running, lets assign
        // that to the concourseExecution. That way we won't fail it in API. It would be
        // wierd to see sucessful build events added to a failed execution!
        concourseExecution = _.filter(concourseExecution, e => isRunning(e))[0] || concourseExecution[0];
      } else {
        concourseExecution = concourseExecution[0];
      }

      if (!concourseExecution) {
        // The pipeline isn't in concourse
        tasks.push(failExecution(apiExecution, {
          status: 'Pipeline not found'
        }));
        tasks.push(clearPipelineId(apiExecution));
      } else {
        if (!isRunning(concourseExecution)) {
          // The pipeline failed in concourse, but API wasn't notified
          tasks.push(failExecution(apiExecution, concourseExecution));
          tasks.push(attachConcourseLogs(apiExecution, concourseExecution));
        } else {
          // The pipeline is still running in concourse, we don't force
          // a timeout, but will let concourse timeout the build itself.
          // Use debug here, otherwise it will be really noisy.
          logger.debug(`API execution ${apiExecution.id} is still running in concourse, skipping.`);
        }
      }
    });

    return async.series(tasks, callback);

    function isRunning(concourseExecution) {
      // Concourse states are: pending, started, errored, failed, aborted, success
      return concourseExecution.status === 'started' || concourseExecution.status === 'pending';
    }

    function failExecution(apiExecution, concourseExecution) {
      logger.info(`Force failing execution ${apiExecution.id} - Concourse pipeline status: ${concourseExecution.status}.`);
      return (cb) => {
        var date = new Date(),
          failEvent = {
            name: 'Pipeline Failed',
            type: 'watchdog',
            state: 'failed',
            build_id: apiExecution.id,
            startDate: date,
            endDate: date
          };

        connection.models.build_step.create(failEvent, (err, event) => {
          if (err || !event) {
            logger.warn(`Unable to create build_step to fail ${apiExecution.id}`);
          }

          return cb();
        });
      };
    }

    function clearPipelineId(apiExecution) {
      return (cb) => {
        apiExecution.concourse_pipeline_id = '';
        apiExecution.save((err) => {
          if (err) {
            logger.warn(`Unable to clear the concourse_pipeline_id for execution ${apiExecution.id}: ${err.message}`);
          }
          return cb();
        });
      };
    }

    function attachConcourseLogs(apiExecution, concourseExecution) {
      return (cb) => {
        async.waterfall([
          getLogsFromConcourse,
          saveArtifact,
          updateEvent
        ], (err) => {
          if (err) {
            logger.error(`Unable to attach artifact logs for execution ${apiExecution.id}: ${err.message}`);
          }
          return cb();
        });

        function getLogsFromConcourse(next) {
          utils.concourse
            .client(logger)
            .getPipelineLogs(concourseExecution.pipeline, concourseExecution.job, next);
        }

        function saveArtifact(logs, next) {
          var newArtifact = {
            name: `watchdog_${uuid.v4()}`,
            type: 'watchdog',
            build_id: apiExecution.id,
            createdDate: new Date(Date.now())
          };

          actuators.artifacts.createArtifact(newArtifact, logs, logger, next);
        }

        function updateEvent(savedArtifact, next) {
          connection.models.build_step.find({
            build_id: apiExecution.id,
            name: 'Pipeline Failed'
          }, (err, events) => {
            if (err || events.length !== 1) {
              err = err || new Error(`Expected to find a 'Pipeline Failed' event for execution ${apiExecution.id}.`);
              return next(err);
            }

            events[0].artifact_id = savedArtifact.id;
            events[0].save(next);
          });
        }
      };
    }
  }
};
