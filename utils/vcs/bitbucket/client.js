var request = require('request'),
  HttpStatus = require('http-status-codes'),
  webhookHelpers = require('./webhookHelpers'),
  utils = require('../../../utils');

module.exports = function (vcsInstance) {
  this.vcsInstance = vcsInstance;

  this.getFileContents = function getFileContents(token, owner, repo, branch, filePath, done) {
    throw new Error('Not Implemented');
  };

  this.getCommit = function getCommit(token, owner, repo, sha, done) {
    // https://confluence.atlassian.com/bitbucket/commits-or-commit-resource-389775478.html#commitsorcommitResource-GETanindividualcommit
    // https://api.bitbucket.org/2.0/repositories/{owner}/{repo_slug}/commit/{revision}
    var requestUri = `${this.vcsInstance.api_url}/repositories/${owner}/${repo}/commit/${sha}`,
      options;
    options = {
      method: 'GET',
      uri: requestUri,
      rejectUnauthorized: !this.vcsInstance.skip_ssl_validation,
      json: true,
      headers: {
        'User-Agent': utils.constants.System.Name,
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    };

    return makeRequest(options, HttpStatus.OK,
      (err, commit) => {
        if (err) {
          utils.logger.error(`Unable to retrieve BitBucket Repo commit with sha ${sha}`, err);
          return done(err);
        }

        return done(err, webhookHelpers.extractCommit('commit', commit, token));
      });
  };

  this.addWebhook = function addWebhook(project, done) {
    // https://confluence.atlassian.com/bitbucket/webhooks-resource-735642279.html#webhooksResource-POSTawebhook
    // POST  https://api.bitbucket.org/2.0/repositories/{owner}/{repo_slug}/hooks
    var requestUri = `${this.vcsInstance.api_url}/repositories/${project.repo_owner}/${project.repo_name}/hooks`,
      options;
    options = {
      method: 'POST',
      rejectUnauthorized: !this.vcsInstance.skip_ssl_validation,
      uri: requestUri,
      json: {
        'description': utils.constants.System.Name,
        'url': project.repo_webhookurl,
        'skip_cert_verification': true,
        'active': true,
        'events': ['repo:push', 'pullrequest:created', 'pullrequest:updated', 'pullrequest:rejected', 'pullrequest:fulfilled']
      },
      headers: {
        'User-Agent': utils.constants.System.Name,
        'Authorization': `Bearer ${project.token}`
      }
    };

    return makeRequest(options, HttpStatus.CREATED,
      (err, webhook) => {
        if (err) {
          utils.logger.error(`Unable to create webhook for BitBucket Repo ${project.repo_name}`, err);
          return done(err);
        }

        // bitbucket webhook uuids are enclosed in parantheses.
        // {
        //   'uuid': '{afe61e14-2c5f-49e8-8b68-ad1fb55fc052}',
        //   'description': 'Webhook Description',
        //   'url': 'https://webhookendpoint.com/'
        // }
        webhook = {
          id: webhook.uuid.replace('{', '').replace('}', '')
        };

        return done(err, webhook);
      });
  };

  this.deleteWebhook = function deleteWebhook(project, done) {
    // DELETE  https://api.bitbucket.org/2.0/repositories/{owner}/{repo_slug}/hooks/{uuid}
    var requestUri,
      options;

    requestUri = `${this.vcsInstance.api_url}/repositories/${project.repo_owner}/${project.repo_name}/hooks/${project.repo_webHookId}`;
    options = {
      method: 'DELETE',
      uri: requestUri,
      rejectUnauthorized: !this.vcsInstance.skip_ssl_validation,
      headers: {
        'User-Agent': utils.constants.System.Name,
        'Authorization': `Bearer ${project.token}`
      }
    };

    return makeRequest(options, HttpStatus.NO_CONTENT, (err) => {
      if (err) {
        utils.logger.error('Error deleting BitBucket Web Hook', err);
      }

      return done(err);
    });
  };

  this.refreshProjectToken = function (project, done) {
    // https://confluence.atlassian.com/bitbucket/oauth-on-bitbucket-cloud-238027431.html#OAuthonBitbucketCloud-Refreshtokens
    utils.logger.info(`Refreshing OAuth token for project with id : ${project.id}`);
    var authHeader,
      projectCredential = project.credential,
      vcsCredentials = project.vcs.credential,
      requestUri = "https://bitbucket.org/site/oauth2/access_token",
      options;

    if (!project.credential || !project.credential.credential_value) {
      return done(null, project);
    }

    authHeader = "Basic " + new Buffer(vcsCredentials.credential_key + ":" + vcsCredentials.credential_value).toString("base64");
    options = {
      method: "POST",
      rejectUnauthorized: !project.vcs.skip_ssl_validation,
      uri: requestUri,
      json: true,
      form: {
        grant_type: 'refresh_token',
        refresh_token: projectCredential.credential_value
      },
      headers: {
        "Authorization": authHeader
      }
    };

    return makeRequest(options, HttpStatus.OK, (err, token) => {
      if (err) {
        utils.logger.error(`Unable to refresh BitBucket OAuth token:`, err);
        return done(err, project);
      }
      utils.logger.info('Succesfully refresh BitBucket OAuth token');
      project.token = token.access_token;
      return done(err, project);
    });
  }

  this.updatePRStatus = function updatePRStatus(token, owner, repo, sha, state, description, done) {
    // POST  https://api.bitbucket.org/2.0/repositories/{owner}/{repo_slug}/commit/{revision}/statuses/build

    var requestUri,
      options;

    requestUri = `${this.vcsInstance.api_url}/repositories/${owner}/${repo}/commit/${sha}/statuses/build`;
    options = {
      method: 'POST',
      uri: requestUri,
      rejectUnauthorized: !this.vcsInstance.skip_ssl_validation,
      json: {
        key: `n0dejs-api-STATUS-${sha}`.substring(0, 39),
        name: `${utils.constants.System.Name}: ${description}`,
        state: state,
        url: utils.settings.crest.publicUri,
        description: description
      },
      headers: {
        'User-Agent': utils.constants.System.Name,
        'Authorization': `Bearer ${token}`
      }
    };
    return makeRequest(options, (err) => {
      if (err) {
        utils.logger.error(`Unable to update PR status to pending for BitBucket Repo ${repo}`, err);
      }

      return done(err);
    });
  };

  function makeRequest(options, expectedStatusCode, done) {
    var ignoreResponseStatus = false;
    if (arguments.length === 2) {
      done = arguments[1];
      expectedStatusCode = null;
    }
    request(options, (error, response, body) => {
      if (error || !expectedStatusCode) {
        return done(error, body);
      }

      if (response && response.statusCode !== expectedStatusCode) {
        if (body) {
          body = body.error || body;
          if (body instanceof Object) {
            body = JSON.stringify(body);
          }
          body = new Error(body);
        } else {
          body = new Error('Request failed');
        }

        body.status = body.status || response.statusCode;
        return done(body);
      }

      return done(error, body);
    });
  }
}
