var GitHub = require('github'),
  async = require('async'),
  url = require('url'),
  webhookHelpers = require('./webhookHelpers'),
  utils = require('../../../utils');

module.exports = function (vcsInstance) {
  this.vcsInstance = vcsInstance;

  this.addWebhook = function addWebhook(project, callback) {
    var webHook = {
        user: project.repo_owner,
        repo: project.repo_name,
        name: 'web',
        active: true,
        events: [
            'push',
            'pull_request'
          ],
        config: {
          url: project.repo_webhookurl,
          content_type: 'json',
          secret: project.repo_secret,
          insecure_ssl: '1'
        }
      },
      self = this;

    function getGithubClient(callback) {
      return createGitHubClient(self.vcsInstance.api_url, project.token, self.vcsInstance.skip_ssl_validation, callback);
    }

    function createWebhook(gitClient, callback) {
      gitClient.repos.createHook(webHook, callback);
    }

    async.waterfall([
      getGithubClient,
      createWebhook
      ],
      (err, result) => {
        if (err) {
          utils.logger.error('Error creating GitHub Web Hook', err);
        }

        return callback(err, result);
      }
    );
  }

  this.deleteWebhook = function deleteWebhook(project, done) {

    var delMsg = {
        user: project.repo_owner,
        repo: project.repo_name,
        id: project.repo_webHookId
      },
      self = this;

    function getGithubClient(callback) {
      return createGitHubClient(self.vcsInstance.api_url, project.token, self.vcsInstance.skip_ssl_validation, callback);
    }

    function removeWebhook(gitClient, callback) {
      gitClient.repos.deleteHook(delMsg, callback);
    }

    async.waterfall([
      getGithubClient,
      removeWebhook
      ],
      (err) => {
        if (err) {
          utils.logger.error('Error deleting GitHub Web Hook', err);
        }
        return done(err);
      }
    );
  }

  this.getCommit = function getCommit(token, owner, repo, sha, done) {
    var steps = [],
      self = this;

    function getGithubClient(callback) {
      return createGitHubClient(self.vcsInstance.api_url, token, self.vcsInstance.skip_ssl_validation, callback);
    }

    function getGithubCommit(gitClient, callback) {
      utils.logger.info(`Retrieving GitHub Repo commit with sha ${sha}`);
      gitClient.repos.getCommit({
        user: owner,
        repo: repo,
        sha: sha
      }, callback);
    }

    async.waterfall([
      getGithubClient,
      getGithubCommit
      ],
      (err, commit) => {
        if (err) {
          utils.logger.error(`Unable to retrieve GitHub Repo commit with sha ${sha}`, err);
          return done(err);
        }

        return done(null, webhookHelpers.extractCommit("commit", commit, token));
      });
  };

  this.getFileContents = function getFileContents(token, owner, repo, branch, filePath, done) {
    var steps = [],
      self = this;

    function getGithubClient(callback) {
      return createGitHubClient(self.vcsInstance.api_url, token, self.vcsInstance.skip_ssl_validation, callback);
    }

    function getGithubFileContents(gitClient, callback) {
      utils.logger.info(`Retrieving GitHub Repo content at path ${filePath}`);
      return gitClient.repos.getContent({
        user: owner,
        repo: repo,
        ref: branch,
        path: filePath
      }, callback);
    }

    async.waterfall([
      getGithubClient,
      getGithubFileContents
    ], (err, response) => {
      if (err) {
        utils.logger.error(`Unable to retrieve GitHub Repo content at path ${filePath}`, err);
        return done(err);
      }

      return done(err, response.content);
    });
  };

  this.updatePRStatus = function updatePRStatus(token, owner, repo, sha, state, description, callback) {
    var status = {
        user: owner,
        repo: repo,
        sha: sha,
        state: state,
        description: description,
        target_url: utils.settings.crest.publicUri,
        context: utils.constants.System.Name
      },
      steps = [],
      self = this;

    function getGithubClient(callback) {
      return createGitHubClient(self.vcsInstance.api_url, token, self.vcsInstance.skip_ssl_validation, callback);
    }

    function createGithubStatus(gitClient, callback) {
      utils.logger.info(`Setting status for GitHub Repo commit with sha ${sha}`);
      return gitClient.repos.createStatus(status, callback);
    }

    async.waterfall([
      getGithubClient,
      createGithubStatus
      ],
      (err, result) => {
        if (err) {
          utils.logger.error('Error updating GitHub PR Status', err);
        }

        return callback(err, result);
      }
    );
  };

  function createGitHubClient(apiUrl, token, skip_ssl_validation, done) {
    var gitHubClient, apiPath = url.parse(apiUrl);

    if (apiPath.path === "/") {
      apiPath.path = "";
    }

    try {
      utils.logger.info('creating GitHub Client');
      gitHubClient = new GitHub({
        version: '3.0.0',
        host: apiPath.host,
        protocol: apiPath.protocol.replace(':', ''),
        port: apiPath.port,
        pathPrefix: apiPath.path,
        rejectUnauthorized: !skip_ssl_validation
      });

      gitHubClient.authenticate({
        type: 'oauth',
        token: token
      });
    } catch (ex) {
      return done(ex);
    }

    return done(null, gitHubClient);
  }
}
