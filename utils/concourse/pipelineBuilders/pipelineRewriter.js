var _ = require('lodash'),
  core = require('../core'),
  utils = require('../../../utils/'),
  utilities = require('./utilities');

function PipelineRewriter() {

}

PipelineRewriter.prototype.notifyTargets = function (project, build, commit, notificationTargets, statusUri, status) {

  if (status.indexOf("create-build-event") > -1) {
    return;
  }

  // Add all notifiers for the current phase.
  var builder = new core.PipelineBuilder(),
    notificationsAggregate;

  if (notificationTargets && notificationTargets.length > 0) {
    notificationsAggregate = builder.Aggregate()
  }

  _.each(notificationTargets, function (notificationTarget) {
    notificationsAggregate.PutResource(
      utilities.notify(status, notificationTarget, project, build, commit, statusUri)
    );
  });

  // Return the tasks that notify CE API and other targets.
  return notificationsAggregate;
};

PipelineRewriter.prototype.annotateDockerPut = function (task, project, build, commit, notificationTargets, statusUri) {
  // create a task to upload the task logs and
  // notify the listeners of the task status.

  var self = this,
    taskName = "Docker build & push",
    logPath = '',
    successBuildEvent,
    failureBuildEvent,
    onSuccess,
    onFailure,
    logFile = '';

  onSuccess = self.notifyTargets(project, build, commit,
    notificationTargets, statusUri, taskName + " Succeeded");
  onFailure = self.notifyTargets(project, build, commit,
    notificationTargets, statusUri, taskName + " Failed");

  successBuildEvent = utilities.createBuildEvent(build.id, taskName);
  successBuildEvent.config.params.event_result = "succeeded";

  failureBuildEvent = utilities.createBuildEvent(build.id, taskName);
  failureBuildEvent.config.params.event_result = "failed";

  if (onSuccess) {
    // if there are more than zero notification targets, the return value of the notifyTargets method
    // is an aggregate which we can attach more tasks to.
    onSuccess = onSuccess.Task(successBuildEvent);
  } else {
    // If there are no notification targets, we will attach the successBuildEvent as the sole
    // on_success handler.
    onSuccess = successBuildEvent
  }

  if (onFailure) {
    onFailure = onFailure.Task(failureBuildEvent);
  } else {
    // If there are no notification targets, we will attach the failureBuildEvent as the sole
    // on_failure handler.
    onFailure = failureBuildEvent;
  }

  task.on_success = onSuccess;
  task.on_failure = onFailure;
  return task;

};

PipelineRewriter.prototype.annotateConcourseTaskStarted = function (jobPlan, index, task, project, build, commit, notificationTargets, statusUri) {
  // create a task to upload the task logs and
  // notify the listeners of the task status.

  var self = this,
    taskName = '',
    createStartEvent;

  if (task.task) {
    taskName = task.task + " Started";
  } else if (task.put) {
    taskName = "Docker build & push Started";
  }

  onStarted = self.notifyTargets(project, build, commit,
    notificationTargets, statusUri, taskName);

  createStartEvent = utilities.createBuildEvent(build.id,
    taskName
  );

  delete createStartEvent.config.params.event_exit_code;
  createStartEvent.config.params.event_result = "running";
  if (onStarted) {
    createStartEvent = createStartEvent.onSuccess(onStarted);
  }

  jobPlan.splice(index, 0, createStartEvent);
};

PipelineRewriter.prototype.annotateConcourseTaskCompleted = function (task, project, build, commit, notificationTargets, statusUri) {
  // create a task to upload the task logs and
  // notify the listeners of the task status.

  var self = this,
    taskName = task.task,
    logPath = '',
    createBuildEvent,
    onSuccess,
    onFailure,
    logFile = '';

  onSuccess = self.notifyTargets(project, build, commit,
    notificationTargets, statusUri, taskName + " Succeeded");
  onFailure = self.notifyTargets(project, build, commit,
    notificationTargets, statusUri, taskName + " Failed");
  if (task.config && task.config.outputs && task.config.outputs.length > 0) {
    // If this task has an output defined, we will read the logs from the
    // output folder and upload the logs to API.
    logPath = task.config.outputs[0].path || task.config.outputs[0].name;
    logFile = task.config.foo_logfile;
    createBuildEvent = utilities.createBuildEvent(build.id,
      taskName,
      logPath,
      logFile
    );

    if (onSuccess) {
      createBuildEvent = createBuildEvent.onSuccess(onSuccess);
    }
    if (onFailure) {
      createBuildEvent = createBuildEvent.onFailure(onFailure);
    }

    task.ensure = createBuildEvent;
  } else {
    // If this task doesn't have an output folder,
    // we will add on_success and on_failure handlers to
    // update API about the result of this step and not capture any logs.
    if (onSuccess) {
      task.on_success = onSuccess;
    }
    if (onFailure) {
      task.on_failure = onFailure;
    }
  }
};

PipelineRewriter.prototype.pipelineCompleted = function (project, build, commit, notificationTargets, statusUri) {
  var self = this,
    pipelineCompletedEvent = utilities.createBuildEvent(build.id, utils.constants.Status.PipelineCompleted);
  if (notificationTargets && notificationTargets.length > 0) {
    pipelineCompletedEvent.ensure = self.notifyTargets(project, build, commit, notificationTargets, statusUri, utils.constants.Status.PipelineCompleted);
  }
  return pipelineCompletedEvent;
};

PipelineRewriter.prototype.rewritePipeline = function (pipeline, project, build, commit, notificationTargets, deploymentTarget) {
  var self = this,
    settings = utils.settings,
    shouldRewrite = false;

  statusUri = utilities.getPublicStatusUri(build.id);

  // Register and create all the notififers associated with this build-pipeline
  _.each(notificationTargets, function (notificationTarget) {
    pipeline.ResourceType(utilities.registerNotifier(notificationTarget));
    pipeline.Resource(utilities.createNotifier(notificationTarget, project, build, commit));
  });


  _.each(pipeline.jobs, function (job) {
    for (var index = 0; index < job.plan.length; index++) {
      var planItem = job.plan[index];
      // if this item in the plan is a get-resource.
      if (planItem.get || planItem.aggregate) {
        shouldRewrite = false;
      }

      // if this item in the plan is a task and doesn't already have an ensure handler.
      if (planItem.task && !planItem.ensure) {
        shouldRewrite = true;
      }

      if (shouldRewrite) {
        // attach an ensure task to add foobar events to this task.
        self.annotateConcourseTaskStarted(job.plan, index, planItem, project, build, commit, notificationTargets, statusUri);
        index += 1;
      }
    }
  });

  _.each(pipeline.jobs, function (job) {
    _.each(job.plan, function (planItem) {
      // if this item in the plan is a get-resource.
      if (planItem.get || planItem.aggregate) {
        shouldRewrite = false;
      }

      // if this item in the plan is a task and doesn't already have an ensure handler.
      if (planItem.task && !planItem.ensure) {
        shouldRewrite = true;
      }

      // If this is a put-resource.
      if (planItem.put) {
        // and is being used to build and push a docker image.
        if (planItem.params && planItem.params.foo_docker_put) {
          self.annotateDockerPut(planItem, project, build, commit, notificationTargets, statusUri);
          return;
        }
      }

      if (shouldRewrite) {
        // attach an ensure task to add foobar events to this task.
        self.annotateConcourseTaskCompleted(planItem, project, build, commit, notificationTargets, statusUri);
      }
      return;
    });

    // add a task to notify API that the concourse pipeline has completed.
    job.plan.push(
      self.pipelineCompleted(project, build, commit, notificationTargets, statusUri)
    );
  });
};

module.exports = PipelineRewriter;
