var crypto = require('crypto'),
  url = require('url'),
  _ = require('lodash'),
  common = require('../common.js'),
  utils = require('../../../utils');


// TODO: This is a webhook payload, make sure that gitClient.getCommit is consistent with these.
exports.extractCommit = function extractCommit(eventType, payload, token) {
  var commitBody;
  switch (eventType) {
    case "commit":
      commitBody = {
        'title': payload.commit.message,
        'message': payload.commit.message,
        'commitSha': payload.sha,
        'commitUrl': payload.html_url,
        'compareUrl': payload.html_url,
        'timestamp': payload.commit.author.date
      };
      _.extend(commitBody, extractAuthor(payload.author));
      return commitBody;

    case "push":
      commitBody = {
        timestamp: payload.head_commit.timestamp || new Date().toISOString(),
        title: payload.head_commit.message,
        message: payload.head_commit.message,
        compareUrl: payload.compare,
        commitUrl: payload.head_commit.url,
        commitSha: payload.head_commit.id,
        repo_branch: payload.ref.toString().split('/').pop(),
        base_branch: payload.ref.toString().split('/').pop(),
        clone_url: exports.getCloneUrl(payload.repository.clone_url, token)
      };
      _.extend(commitBody, extractAuthor(payload.sender));
      return commitBody;

    case "pull_request":
      commitBody = {
        number: payload.number,
        message: payload.pull_request.body,
        timestamp: payload.pull_request.created_at || new Date().toISOString(),
        title: payload.pull_request.title,
        compareUrl: payload.pull_request.diff_url,
        commitUrl: payload.pull_request.html_url,
        commitSha: payload.pull_request.head.sha,
        repo_branch: payload.pull_request.head.ref,
        base: {
          repo: {
            full_name: payload.pull_request.base.repo.full_name
          },
          repo_branch: payload.pull_request.base.ref,
          clone_url: exports.getCloneUrl(payload.pull_request.base.repo.clone_url, token)
        },
        clone_url: exports.getCloneUrl(payload.pull_request.head.repo.clone_url, token),
        base_branch: payload.pull_request.base.ref
      };

      _.extend(commitBody, extractAuthor(payload.sender));
      return commitBody;
  }
};

exports.friendlyEventTypes = {
  PING: 'ping',
  PUSH: 'push',
  PR_OPENED: 'pr_opened',
  PR_UPDATED: 'pr_synchronize',
  PR_REOPENED: 'pr_reopened',
  PR_CLOSED: 'pr_closed'
};

exports.getFriendlyEventType = function getFriendlyEventType(eventType, action) {
  var friendlyEventType = eventType;

  if (friendlyEventType === 'pull_request') {
    friendlyEventType = `pr_${action}`;
  }

  return friendlyEventType;
};

exports.getCloneUrl = function getCloneUrl(httpUrl, token) {
  var parsedUrl = url.parse(httpUrl);
  return `${parsedUrl.protocol}//${token}@${parsedUrl.host}${parsedUrl.pathname}`;
};

exports.getWebhookUrl = function getWebhookUrl(project) {
  return common.getWebhookUrl('github', project);
};

exports.isPullRequest = function isPullRequest(eventType) {
  return eventType === 'pull_request';
};

exports.isSupportedEvent = function isSupportedEvent(eventType, message) {
  var isSupported = eventType === 'push' || eventType === 'ping',
    supportedPRAction = false,
    canMerge = false;

  if (eventType === 'pull_request') {
    // is the action 'opened' or 'synchronized'?
    supportedPRAction = (
      message.action === 'opened' ||
      message.action === 'synchronize' ||
      message.action === 'reopened' ||
      message.action === 'closed');

    // From : https://developer.github.com/v3/pulls/#response-1
    // <quote>
    // The value of the mergeable attribute can be true, false, or null.
    // If the value is null, this means that the mergeability hasn't been computed yet,
    // and a background job was started to compute it.
    // </quote>
    // If the mergeability is unknown we will kick off the build for this PR.
    // Since the first step in a PR flow tries to merge the branches,
    // we will fail the build if a PR cannot be merged.
    canMerge = message.pull_request.mergeable !== false;
    // we require a mergable branch & a supported action.
    isSupported = supportedPRAction && canMerge;
  }

  return isSupported;
};

exports.isValidHmac = function isValidHmac(secret, payload, githubSignature, logger) {
  var calculatedSignature, hmac;
  hmac = crypto
    .createHmac('sha1', new Buffer(secret, 'utf-8'))
    .update(new Buffer(JSON.stringify(payload), 'utf-8'))
    .digest('hex');

  calculatedSignature = `sha1=${hmac}`;
  logger.debug(`isValidHmac [calculatedSignature: ${calculatedSignature}, githubSignature: ${githubSignature}]`);

  return calculatedSignature === githubSignature;
};

exports.isValidPayload = function (eventType, payload, logger) {
  if (eventType === 'push') {
    return (payload &&
      payload.compare &&
      payload.head_commit &&
      payload.head_commit.timestamp &&
      payload.head_commit.url &&
      payload.head_commit.author &&
      payload.head_commit.author.name);
  }

  if (eventType === 'pull_request') {
    return (payload &&
      payload.pull_request &&
      payload.sender &&
      payload.sender.login &&
      payload.pull_request.created_at &&
      payload.pull_request.title &&
      payload.pull_request.diff_url &&
      payload.pull_request.commits_url &&
      payload.pull_request.head &&
      payload.pull_request.head.sha);
  }
};

exports.isValidBranch = function (eventType, payload, project) {
  // We get commit here rather than passing it in, because we use a dummy token.
  var commit = exports.extractCommit(eventType, payload, '');
  return commit.base_branch && commit.base_branch === project.repo_branch;
};

function extractAuthor(author) {
  author = author || {
    login: "unkown",
    avatar_url: 'https://api.n0dejs.com'
  };

  return {
    'author': author.login,
    'avatarUrl': author.avatar_url
  };
}
