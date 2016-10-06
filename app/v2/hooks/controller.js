var _ = require('lodash'),
  async = require('async'),
  httpStatus = require('http-status-codes'),
  actuators = require('../../../utils/actuators'),
  githubWebHookHelpers = require('../../../utils/vcs/github/webhookHelpers'),
  bitbucketWebhookHelpers = require('../../../utils/vcs/bitbucket/webhookHelpers'),
  utils = require('../../../utils');

exports.bitbucketWebhookHandler = function bitbucketWebhookHandler(req, res, next) {
  var eventType = req.headers['x-event-key'],
    webhookId = req.headers['x-hook-uuid'],
    projectId = req.params.project_id;

  req.logger.info(`BitBucket webhook event received for project: ${projectId}`);
  if (!bitbucketWebhookHelpers.isSupportedEvent(eventType, req.body)) {
    // BitBucket will fire webhooks for all events, so if we don't support it, ignore it.
    var ignoreMessage = `BitBucket webhook event ignored for project: ${projectId}, [${eventType}]`;
    req.logger.info(ignoreMessage);
    return res.send(ignoreMessage);
  }

  return async.waterfall([
    getProject,
    validateMessage,
    exports.getVCSInstance,
    processWebhookEvent
  ], onComplete);

  function getProject(callback) {
    req.db.models.project.get(projectId, (err, project) => {
      if (!project) {
        err = err || new Error(`ORM returned no error and no entity for project ${projectId}`);
      }

      return callback(err, project);
    });
  }

  function validateMessage(project, callback) {
    req.logger.info("Validating webhook UUID");
    if (webhookId !== project.repo_webHookId) {
      return callback(new Error('BitBucket webhook message failed validation of its Webhook.'));
    }

    req.logger.info("Validating webhook payload");
    if (bitbucketWebhookHelpers.isValidPayload(eventType, req.body, req.logger) &&
      bitbucketWebhookHelpers.isValidBranch(eventType, req.body, project)) {
      var commit = bitbucketWebhookHelpers.extractCommit(eventType, req.body, project.token);
      return callback(null, project, commit);
    }

    return callback(new Error('BitBucket webhook message failed validation of its Hmac, Payload, and Branch.'));
  }

  function processWebhookEvent(project, commit, callback) {
    req.logger.info("Processing webhook event");
    var friendlyEventType = bitbucketWebhookHelpers.getFriendlyEventType(eventType, req.body.action),
      types = bitbucketWebhookHelpers.friendlyEventTypes;

    switch (friendlyEventType) {
      case types.PUSH:
        commit.clone_url = utils.vcs(project.vcs).webhookHelpers.getCloneUrl(project.repo_cloneUrl, project.token);
        return actuators.bitbucket.startExecution(friendlyEventType, project, commit, req.logger, callback);
      case types.PR_OPENED:
      case types.PR_UPDATED:
        return actuators.bitbucket.startExecution(friendlyEventType, project, commit, req.logger, callback);
      case types.PR_CLOSED:
        return actuators.bitbucket.processPRClosed(project, commit, req.logger, callback);
    }
  }

  function onComplete(err, result) {
    if (err) {
      req.logger.info(`BitBucket webhook event declined for project: ${projectId}`);
      return next(err);
    }

    req.logger.info(`BitBucket webhook event accepted for project: ${projectId}`);
    res.status(httpStatus.ACCEPTED).send('Build Request Accepted');
  }
}

exports.githubWebhookHandler = function githubWebhookHandler(req, res, next) {
  var eventType = req.headers['x-github-event'],
    payloadSHA1Signature = req.headers['x-hub-signature'],
    projectId = req.params.project_id,
    repoSecretClearText;

  req.logger.info(`GitHub webhook event received for project: ${projectId}`);

  if (!githubWebHookHelpers.isSupportedEvent(eventType, req.body)) {
    // GitHub will fire webhooks for all events, so if we don't support it, ignore it.
    var ignoreMessage = `GitHub webhook event ignored for project: ${projectId}, [${eventType}:${req.body.action}]`;
    req.logger.info(ignoreMessage);
    return res.send(ignoreMessage);
  }

  if (eventType === 'ping') {
    var pingMessage = `GitHub webhook PING received for project: ${projectId}`;
    req.logger.info(pingMessage);
    return res.send(pingMessage);
  }

  return async.waterfall([
    getProject,
    validateMessage,
    exports.getVCSInstance,
    processWebhookEvent
  ], onComplete);

  function getProject(callback) {
    req.db.models.project.get(projectId, (err, project) => {
      if (!project) {
        err = err || new Error(`ORM returned no error and no entity for project ${projectId}`);
      }

      return callback(err, project);
    });
  }

  function validateMessage(project, callback) {
    req.logger.info("Validation Webhook payload");
    repoSecretClearText = utils.database.connection.decryptValue(project.repo_secret);
    if (githubWebHookHelpers.isValidHmac(repoSecretClearText, req.body, payloadSHA1Signature, req.logger) &&
      githubWebHookHelpers.isValidPayload(eventType, req.body, req.logger) &&
      githubWebHookHelpers.isValidBranch(eventType, req.body, project)) {

      var commit = githubWebHookHelpers.extractCommit(eventType, req.body, project.token);
      return callback(null, project, commit);
    }

    return callback(new Error('GitHub webhook message failed validation of its Hmac, Payload, and Branch.'));
  }

  function processWebhookEvent(project, commit, callback) {
    req.logger.info("Processing webhook event");
    var friendlyEventType = githubWebHookHelpers.getFriendlyEventType(eventType, req.body.action),
      types = githubWebHookHelpers.friendlyEventTypes;

    switch (friendlyEventType) {
      case types.PR_CLOSED:
        return actuators.github.processPRClosed(project, commit, req.logger, callback);
      case types.PUSH:
      case types.PR_OPENED:
      case types.PR_REOPENED:
      case types.PR_UPDATED:
        return actuators.github.startExecution(eventType, project, commit, req.logger, callback);
    }
  }

  function onComplete(err, result) {
    if (err) {
      req.logger.info(`GitHub webhook event declined for project: ${projectId}`);
      return next(err);
    }

    req.logger.info(`GitHub webhook event accepted for project: ${projectId}`);
    res.status(httpStatus.ACCEPTED).send('Build Request Accepted');
  }
};

exports.getVCSInstance = function getVCSInstance(project, commit, callback) {
  project.getVcs({
    autoFetch: true,
    autoFetchLimit: 2
  }, (err, vcs) => {
    if (!vcs) {
      err = err || new Error(`Unable to retrieve vcs for project ${project.name}, no ORM error.`);
    } else {
      project.vcs = vcs;
    }

    return callback(err, project, commit);
  });
}
