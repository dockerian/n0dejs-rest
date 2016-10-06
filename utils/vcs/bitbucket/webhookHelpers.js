var url = require('url'),
  _ = require('lodash'),
  common = require('../common.js'),
  utils = require('../../../utils');

exports.extractCommit = function extractCommit(eventType, payload, token) {
  var latestChange, commitBody;
  switch (eventType) {
    case "commit":
      commitBody = {
        'title': payload.message,
        'message': payload.message,
        'commitSha': payload.hash,
        'commitUrl': payload.links.html.href,
        'compareUrl': payload.links.diff.href,
        'timestamp': payload.date
      };

      _.extend(commitBody, extractAuthor(payload.author));
      return commitBody;
    case "repo:push":
      latestChange = payload.push.changes[0].new;
      commitBody = {
        'title': latestChange.target.message,
        'message': latestChange.target.message,
        'commitSha': latestChange.target.hash,
        'commitUrl': latestChange.links.html.href,
        'compareUrl': latestChange.links.html.href,
        'base_branch': latestChange.name,
        'repo_branch': latestChange.name,
        'timestamp': latestChange.target.date
      };
      _.extend(commitBody, extractAuthor(latestChange.target.author));

      return commitBody;
    case "pullrequest:created":
    case "pullrequest:updated":
    case "pullrequest:rejected":
    case "pullrequest:fulfilled":
      var pullRequest = payload.pullrequest;
      return {
        number: pullRequest.id,
        author: pullRequest.author.username,
        avatarUrl: pullRequest.author.links.avatar.href,
        message: pullRequest.description || pullRequest.title,
        timestamp: pullRequest.created_on || new Date().toISOString(),
        title: pullRequest.title,
        compareUrl: pullRequest.links.html.href,
        commitUrl: pullRequest.links.html.href,
        commitSha: pullRequest.source.commit.hash,
        repo_branch: pullRequest.source.branch.name,
        base: {
          repo: {
            full_name: pullRequest.destination.repository.full_name
          },
          repo_branch: pullRequest.destination.branch.name,
          clone_url: exports.getCloneUrl(pullRequest.destination.repository.links.html.href, token)
        },
        clone_url: exports.getCloneUrl(pullRequest.source.repository.links.html.href, token),
        base_branch: pullRequest.destination.branch.name
      };

    default:
      throw new Error("Not Supported");
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
  var eventMap = {
    'repo:push': exports.friendlyEventTypes.PUSH,
    'pullrequest:created': exports.friendlyEventTypes.PR_OPENED,
    'pullrequest:updated': exports.friendlyEventTypes.PR_UPDATED,
    'pullrequest:rejected': exports.friendlyEventTypes.PR_CLOSED,
    'pullrequest:fulfilled': exports.friendlyEventTypes.PR_CLOSED
  };


  return eventMap[eventType];
};

exports.getWebhookUrl = function getWebhookUrl(project) {
  return common.getWebhookUrl('bitbucket', project);
};

exports.getCloneUrl = function getCloneUrl(httpUrl, token) {
  // see section "Repository Cloning"
  // at https://developer.atlassian.com/bitbucket/concepts/oauth2.html
  var parsedUrl = url.parse(httpUrl);
  return `${parsedUrl.protocol}//x-token-auth:${token}@${parsedUrl.host}${parsedUrl.pathname}`;
};

exports.isPullRequest = function isPullRequest(eventType) {
  switch (eventType) {
    case "pr_opened":
    case "pr_synchronize":
      return true;
    default:
      return false;
  }
};

exports.isSupportedEvent = function isSupportedEvent(eventType, payload) {
  switch (eventType) {
    case "repo:push":
    case "pullrequest:created":
    case "pullrequest:updated":
    case "pullrequest:rejected":
    case "pullrequest:fulfilled":
      return true;
    default:
      return false;
  }
};

exports.isValidHmac = function isValidHmac(secret, payload, githubSignature, logger) {
  throw new Error("Not Implemented");
};

exports.isValidPayload = function isValidPayload(eventType, payload, logger) {

  switch (eventType) {
    case "repo:push":
      return (payload &&
        payload.push &&
        payload.push.changes &&
        payload.push.changes[0] &&
        payload.push.changes[0].new.links &&
        payload.push.changes[0].new.links.html &&
        payload.push.changes[0].new.target &&
        payload.push.changes[0].new.target.author &&
        payload.push.changes[0].new.target.author.user &&
        payload.push.changes[0].new.target.author.user.links) || false;
    case "pullrequest:created":
    case "pullrequest:updated":
    case "pullrequest:rejected":
    case "pullrequest:fulfilled":
      return (
        payload.pullrequest &&
        payload.pullrequest.id &&
        (payload.pullrequest.title || payload.pullrequest.description) &&
        payload.pullrequest.author &&
        payload.pullrequest.author.username &&
        payload.pullrequest.author.links &&
        payload.pullrequest.author.links.avatar &&
        payload.pullrequest.author.links.avatar.href &&
        payload.pullrequest.author.links.avatar.href &&
        payload.pullrequest.source &&
        payload.pullrequest.source.commit &&
        payload.pullrequest.source.commit.hash &&
        payload.pullrequest.source.branch &&
        payload.pullrequest.source.branch.name &&
        payload.pullrequest.source.repository &&
        payload.pullrequest.source.repository.links &&
        payload.pullrequest.source.repository.links.html &&
        payload.pullrequest.source.repository.links.html.href &&
        payload.pullrequest.destination &&
        payload.pullrequest.destination.branch &&
        payload.pullrequest.destination.branch.name &&
        payload.pullrequest.destination.repository &&
        payload.pullrequest.destination.repository.links &&
        payload.pullrequest.destination.repository.links.html &&
        payload.pullrequest.destination.repository.links.html.href
      ) || false;
  }
};

exports.isValidBranch = function isValidBranch(eventType, payload, project) {
  var commit = exports.extractCommit(eventType, payload, '');
  return commit.base_branch && commit.base_branch === project.repo_branch;
};

function extractAuthor(authorObj) {
  authorObj.user = authorObj.user || {
    username: authorObj.raw,
    links: {
      avatar: {
        href: 'https://api.n0dejs.com'
      }
    }
  };

  return {
    'author': authorObj.user.username,
    'avatarUrl': authorObj.user.links.avatar.href
  };
}
