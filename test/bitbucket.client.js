var should = require('should'),
  utils = require('../utils'),
  sinon = require('sinon'),
  _ = require('lodash'),
  rewire = require('rewire'),
  testHelpers = require('./_helpers.js'),
  CommitPayload = require('./fixtures/bitbucket_commit_payload.json'),
  CreateWebhookPayload = require('./fixtures/bitbucket_create_webhook_payload.json'),
  bitbucketClient = rewire('../utils/vcs/bitbucket/client.js');

describe('utils/bitbucket/client', () => {
  var mockedClient = {},
    mockedBitBucketAPI,
    bitbucketVCS,
    mockedProject;

  before(() => {
    process.env = {
      DOCKER_USERNAME: 'dockerhub_user',
      DOCKER_PASSWORD: 'dockerhub_password',
      DOCKER_EMAIL: 'dockerhub_email@email.com',
      CONCOURSE_ENDPOINT: 'http://myconcourse.ci:8080',
      CONCOURSE_USERNAME: 'concourse_user',
      CONCOURSE_PASSWORD: 'concourse_password',
      GITHUB_CLIENT_ID: 'github_client_id_1234',
      GITHUB_CLIENT_SECRET: 'github_client_secret_5678',
      WEB_URI: '192.168.1.2',
      PUBLIC_API_URL: 'http://api.n0dejs.com/v2',
      API_HOST: '192.168.1.3:3001',
      NGROK_AUTHTOKEN: 'ngrok_token'
    };
    testHelpers.refreshSettings();
  });

  beforeEach(() => {

    mockedProject = {
      repo_owner: 'owner',
      repo_name: 'repo_name',
      repo_webhookurl: 'http://www.google.com/',
      repo_secret: 'secret',
      token: 'token'
    }
    bitbucketVCS = {
      api_url: "http://custom.bitbucket.org/v2",
      skip_ssl_validation: false
    };

    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    bitbucketClient.__set__({
      'utils': utils
    });
  });

  describe('addWebhook', () => {
    var mockedRequest = sinon.stub();

    before(() => {

      bitbucketClient.__set__({
        'request': mockedRequest
      });
    });
    beforeEach(() => {
      bitbucketClient.__set__({
        'request': mockedRequest
      });
    });

    it('should add a webhook', (done) => {
      mockedRequest.callsArgWith(1, null, {
        statusCode: 201
      }, CreateWebhookPayload);

      new bitbucketClient(bitbucketVCS).addWebhook(mockedProject, (err, webhook) => {
        should.not.exist(err);
        mockedRequest.calledWith({
          method: 'POST',
          uri: 'http://custom.bitbucket.org/v2/repositories/owner/repo_name/hooks',
          rejectUnauthorized: true,
          json: {
            description: 'N0deJS API',
            url: 'http://www.google.com/',
            active: true,
            skip_cert_verification: true,
            events: ['repo:push', 'pullrequest:created', 'pullrequest:updated', 'pullrequest:rejected', 'pullrequest:fulfilled']
          },
          headers: {
            'User-Agent': 'N0deJS API',
            Authorization: 'Bearer token'
          }
        }).should.be.true();
        webhook.id.should.be.equal('afe61e14-2c5f-49e8-8b68-ad1fb55fc052');
        done();
      });
    });

    it('should handle failures adding a webhook', (done) => {
      mockedRequest.callsArgWith(1, null, {
        statusCode: 400
      }, {
        error: {
          message: 'OAUTH token expired'
        }
      });

      new bitbucketClient(bitbucketVCS).addWebhook(mockedProject, (err, webhook) => {
        err.message.should.be.equal('{"message":"OAUTH token expired"}');
        err.status.should.be.equal(400);
        should.not.exist(webhook);
        mockedRequest.calledWith({
          method: 'POST',
          uri: 'http://custom.bitbucket.org/v2/repositories/owner/repo_name/hooks',
          rejectUnauthorized: true,
          json: {
            description: 'N0deJS API',
            url: 'http://www.google.com/',
            active: true,
            skip_cert_verification: true,
            events: ['repo:push', 'pullrequest:created', 'pullrequest:updated', 'pullrequest:rejected', 'pullrequest:fulfilled']
          },
          headers: {
            'User-Agent': 'N0deJS API',
            Authorization: 'Bearer token'
          }
        }).should.be.true();
        done();
      });
    });
  });

  describe('deleteWebhook', () => {
    var mockedRequest = sinon.stub();
    beforeEach(() => {
      bitbucketClient.__set__({
        'request': mockedRequest
      });
    });

    it('should delete a webhook', (done) => {
      mockedRequest.callsArgWith(1, null, {
        statusCode: 204
      });

      mockedProject.repo_webHookId = 'WEBHOOKID_IS_A_GUID'
      new bitbucketClient(bitbucketVCS).deleteWebhook(mockedProject, (err) => {

        should.not.exist(err);
        mockedRequest.calledWith({
          method: 'DELETE',
          uri: 'http://custom.bitbucket.org/v2/repositories/owner/repo_name/hooks/WEBHOOKID_IS_A_GUID',
          rejectUnauthorized: true,
          headers: {
            'User-Agent': 'N0deJS API',
            Authorization: 'Bearer token'
          }
        }).should.be.true();

        done();
      })
    });

    it('should handle errors deleting a webhook', (done) => {
      mockedRequest.callsArgWith(1, null, {
        statusCode: 401
      }, {
        error: {
          message: 'Request denied'
        }
      });

      mockedProject.repo_webHookId = 'WEBHOOKID_IS_A_GUID'
      new bitbucketClient(bitbucketVCS).deleteWebhook(mockedProject, (err) => {
        err.message.should.be.equal('{"message":"Request denied"}');
        err.status.should.be.equal(401);
        mockedRequest.calledWith({
          method: 'DELETE',
          uri: 'http://custom.bitbucket.org/v2/repositories/owner/repo_name/hooks/WEBHOOKID_IS_A_GUID',
          rejectUnauthorized: true,
          headers: {
            'User-Agent': 'N0deJS API',
            Authorization: 'Bearer token'
          }
        }).should.be.true();

        done();
      })
    });
  });

  describe('getCommit', () => {
    var mockedRequest = sinon.stub();
    before(() => {

      bitbucketClient.__set__({
        'request': mockedRequest
      });
    });
    it('should get commits', (done) => {
      mockedRequest.callsArgWith(1, null, {
        statusCode: 200
      }, CommitPayload);

      new bitbucketClient(bitbucketVCS).getCommit('token', 'jwalton', 'atlassian-rest', '61d9e64348f9da407e62f64726337fd3bb24b466',
        (err, commit) => {
          mockedRequest.calledWith({
            method: 'GET',
            uri: 'http://custom.bitbucket.org/v2/repositories/jwalton/atlassian-rest/commit/61d9e64348f9da407e62f64726337fd3bb24b466',
            json: true,
            rejectUnauthorized: true,
            headers: {
              'User-Agent': 'N0deJS API',
              Authorization: 'Bearer token',
              Accept: 'application/json'
            }
          }).should.be.true();
          should.not.exist(err);
          commit.commitSha.should.be.equal('61d9e64348f9da407e62f64726337fd3bb24b466');
          commit.author.should.be.equal('jwalton');
          commit.timestamp.should.be.equal('2013-10-21T07:21:51+00:00');
          commit.title.should.be.equal(CommitPayload.message);
          commit.message.should.be.equal(CommitPayload.message);
          commit.compareUrl.should.be.equal(CommitPayload.links.diff.href);
          commit.avatarUrl.should.be.equal(CommitPayload.author.user.links.avatar.href);
          commit.commitUrl.should.be.equal(CommitPayload.links.html.href);
          done();
        });
    });

    it('should handle error getting a commit', (done) => {
      var mockedError = new Error('NOT_FOUND');
      mockedRequest.callsArgWith(1, mockedError);

      new bitbucketClient(bitbucketVCS).getCommit('token', 'jwalton', 'atlassian-rest', '61d9e64348f9da407e62f64726337fd3bb24b466',
        (err, commit) => {
          err.should.be.equal(mockedError);
          should.not.exist(commit);
          done();
        });
    });

    it('should handle error getting a commit, >200 response status', (done) => {
      var mockedError = new Error('NOT_FOUND');
      mockedRequest.callsArgWith(1, null, {
        statusCode: 400
      }, {
        'error': 'Unable to find things'
      });

      new bitbucketClient(bitbucketVCS).getCommit('token', 'jwalton', 'atlassian-rest', '61d9e64348f9da407e62f64726337fd3bb24b466',
        (err, commit) => {
          err.message.should.be.equal('Unable to find things');
          err.status.should.be.equal(400);
          should.not.exist(commit);
          done();
        });
    });

    it('should handle error getting a commit, >200 response status, no error property', (done) => {
      var mockedError = new Error('NOT_FOUND');
      mockedRequest.callsArgWith(1, null, {
        statusCode: 400
      }, {
        message: 'Unable to find things'
      });

      new bitbucketClient(bitbucketVCS).getCommit('token', 'jwalton', 'atlassian-rest', '61d9e64348f9da407e62f64726337fd3bb24b466',
        (err, commit) => {
          err.status.should.be.equal(400);
          err.message.should.be.equal('{"message":"Unable to find things"}');
          should.not.exist(commit);
          done();
        });
    });

    it('should handle error getting a commit, >200 response status, cannot parse response body', (done) => {
      var mockedError = new Error('NOT_FOUND');
      mockedRequest.callsArgWith(1, null, {
        statusCode: 502
      }, ' UNABLE TO FIND THINGS');

      new bitbucketClient(bitbucketVCS).getCommit('token', 'jwalton', 'atlassian-rest', '61d9e64348f9da407e62f64726337fd3bb24b466',
        (err, commit) => {
          should.exist(err);
          err.message.should.be.equal(' UNABLE TO FIND THINGS');
          err.status.should.be.equal(502);
          should.not.exist(commit);
          done();
        });
    });

    it('should handle error getting a commit, >200 response status, no response body', (done) => {
      var mockedError = new Error('NOT_FOUND');
      mockedRequest.callsArgWith(1, null, {
        statusCode: 502
      });

      new bitbucketClient(bitbucketVCS).getCommit('token', 'jwalton', 'atlassian-rest', '61d9e64348f9da407e62f64726337fd3bb24b466',
        (err, commit) => {
          should.exist(err);
          err.message.should.be.equal('Request failed');
          err.status.should.be.equal(502);
          should.not.exist(commit);
          done();
        });
    });
  });

  describe('getFileContents', () => {
    it('should handle invalid token', () => {
      new bitbucketClient(bitbucketVCS).getFileContents.should.throw(/Not Implemented/);
    });

    it('should get file contents', () => {
      new bitbucketClient(bitbucketVCS).getFileContents.should.throw(/Not Implemented/);
    });
  });

  describe('refreshProjectToken', () => {
    var mockedRequest = sinon.stub(),
      tokenPayload;
    before(() => {

      bitbucketClient.__set__({
        'request': mockedRequest
      });
    });

    beforeEach(() => {
      tokenPayload = {
        access_token: 'S_i2NNfS96vg8ogLv4mxBMvZj4Ad7MH_anVcHtRaIirE6WWBtxdaNWscs__YC5Oq8SaszteUOZEx0iv9hMk=',
        scopes: 'pipeline:variable webhook pullrequest:write repository:delete project:write team:write account:write',
        expires_in: 3600,
        refresh_token: 'LrRwh4LzddDCpxz7Aw',
        token_type: 'bearer'
      };
      mockedRequest.callsArgWith(1, null, {
        statusCode: 200
      }, tokenPayload);
    });

    it("Can skip refresh project token, if no valid token credential is found", (done) => {
      mockedRequest.callsArgWith(1, null, {
        statusCode: 200
      }, tokenPayload);
      var project = {
        vcs: {
          credential: {
            credential_key: "client_id",
            credential_value: "client_secret"
          }
        },
        token: "old_token"
      }

      new bitbucketClient(bitbucketVCS).refreshProjectToken(project, (err, project) => {
        should.not.exist(err);
        project.token.should.be.equal("old_token");
        mockedRequest.calledOnce.should.be.false();
        done();
      });
    });

    it("Can skip refresh project token, if no valid refresh token is found", (done) => {
      mockedRequest.callsArgWith(1, null, {
        statusCode: 200
      }, tokenPayload);
      var project = {
        credential: {
          credential_key: "access_token",
          credential_value: ""
        },
        vcs: {
          credential: {
            credential_key: "client_id",
            credential_value: "client_secret"
          }
        },
        token: "old_token"
      }

      new bitbucketClient(bitbucketVCS).refreshProjectToken(project, (err, project) => {
        should.not.exist(err);
        project.token.should.be.equal("old_token");
        mockedRequest.calledOnce.should.be.false();
        done();
      });
    });

    it("Can refresh project token", (done) => {

      mockedRequest.callsArgWith(1, null, {
        statusCode: 200
      }, tokenPayload);

      var project = {
        credential: {
          credential_key: "access_token",
          credential_value: "refresh_token"
        },
        vcs: {
          credential: {
            credential_key: "client_id",
            credential_value: "client_secret"
          }
        },
        token: "old_token"
      }

      new bitbucketClient(bitbucketVCS).refreshProjectToken(project, (err, project) => {
        should.not.exist(err);
        project.token.should.be.equal(tokenPayload.access_token);
        mockedRequest.calledWith({
          method: 'POST',
          rejectUnauthorized: true,
          uri: 'https://bitbucket.org/site/oauth2/access_token',
          json: true,
          form: {
            grant_type: 'refresh_token',
            refresh_token: 'refresh_token'
          },
          headers: {
            Authorization: 'Basic Y2xpZW50X2lkOmNsaWVudF9zZWNyZXQ='
          }
        }).should.be.true();

        done();
      });
    });

    it("Can handle errors refreshing project token", (done) => {
      var errorRefreshing = new Error("Something went wrong with bitbucket");
      mockedRequest.callsArgWith(1, errorRefreshing, {});

      var project = {
        credential: {
          credential_key: "access_token",
          credential_value: "refresh_token"
        },
        vcs: {
          credential: {
            credential_key: "client_id",
            credential_value: "client_secret"
          }
        },
        token: "old_token"
      }

      new bitbucketClient(bitbucketVCS).refreshProjectToken(project, (err, project) => {
        err.should.be.equal(errorRefreshing);
        project.token.should.be.equal("old_token");
        mockedRequest.calledWith({
          method: 'POST',
          rejectUnauthorized: true,
          uri: 'https://bitbucket.org/site/oauth2/access_token',
          json: true,
          form: {
            grant_type: 'refresh_token',
            refresh_token: 'refresh_token'
          },
          headers: {
            Authorization: 'Basic Y2xpZW50X2lkOmNsaWVudF9zZWNyZXQ='
          }
        }).should.be.true();

        done();
      });
    });
  });

  describe('updatePRStatus', () => {
    var mockedRequest = sinon.stub();

    beforeEach(() => {

      bitbucketClient.__set__({
        'request': mockedRequest
      });
    });
    it('should update a PR status', (done) => {

      mockedRequest.callsArgWith(1, null, {
        statusCode: 200
      }, JSON.stringify({
        id: 12
      }));


      new bitbucketClient(bitbucketVCS).updatePRStatus('token', 'owner', 'repo', 'sha', 'state', 'description', (err, result) => {
        should.not.exist(err);
        mockedRequest.calledWith({
          method: 'POST',
          uri: 'http://custom.bitbucket.org/v2/repositories/owner/repo/commit/sha/statuses/build',
          rejectUnauthorized: true,
          json: {
            key: 'n0dejs-api-STATUS-sha',
            name: 'N0deJS API: description',
            state: 'state',
            url: 'http://api.n0dejs.com/v2',
            description: 'description'
          },
          headers: {
            'User-Agent': 'N0deJS API',
            Authorization: 'Bearer token'
          }
        }).should.be.true();
        done();
      });
    });

    it('should not swallow errors on PR status update failure', (done) => {
      mockedRequest.callsArgWith(1, {
        Error: "E_NOTFOUND"
      }, {
        statusCode: 400
      }, JSON.stringify({
        message: "BAD REQUEST"
      }));

      new bitbucketClient(bitbucketVCS).updatePRStatus('token', 'owner', 'repo', 'sha', 'state', 'description', (err, result) => {
        err.Error.should.be.equal('E_NOTFOUND');
        done();
      });
    });
  });
});
