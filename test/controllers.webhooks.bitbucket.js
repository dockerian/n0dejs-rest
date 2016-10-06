var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  CommitPayload = require('./fixtures/bitbucket_commit_payload.json'),
  PushWebHookPayload = require('./fixtures/bitbucket_push_webhook_payload.json'),
  testHelpers = require('./_helpers.js'),
  controller = require('../app/v2/hooks/controller.js');

describe('v2/hooks/controller/bitbucket', () => {
  var mockedRequest, mockedResponse, mockedNext;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    testHelpers.refreshSettings();
  });

  beforeEach(() => {
    mockedRequest = {
      headers: {
        'x-event-key': 'repo:push'
      },
      logger: utils.logger,
      params: {
        project_id: 12
      },
      body: {},
      db: {
        models: {
          project: {
            get: sinon.stub()
          }
        }
      }
    };

    mockedNext = sinon.stub();

    mockedResponse = {
      send: sinon.stub(),
      status: sinon.stub()
    };
  });

  it('Can reject unknown event', (done) => {
    mockedRequest.headers['x-event-key'] = 'CUSTOM_ACTIOn';
    mockedRequest.body = {
      action: 'CUSTOM_ACTIOn'
    };

    mockedResponse.send = (data) => {
      data.should.be.equal('BitBucket webhook event ignored for project: 12, [CUSTOM_ACTIOn]');
      done();
    }

    controller.bitbucketWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });

  it('Can reject webhook for invalid project', (done) => {
    mockedRequest.body.action = 'repo:push';
    mockedRequest.headers['x-event-key'] = 'repo:push';
    mockedRequest.db.models.project.get.callsArgWith(1, null, null);

    mockedNext = (err) => {
      should.exist(err);
      err.should.be.an.instanceof(Error);

      mockedRequest.db.models.project.get.calledOnce.should.be.true();
      mockedResponse.send.called.should.be.false();
      done();
    };

    controller.bitbucketWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });

  it('Can reject webhook for invalid Webhook-UUID on push', (done) => {
    mockedRequest.headers['x-event-key'] = 'repo:push';
    mockedRequest.headers['x-hook-uuid'] = 'NO_A_WEBHOOK_ID';
    mockedRequest.db.models.project.get.callsArgWith(1, null, {
      repo_secret: 'foobar',
      vcs: {
        vcs_type: {
          vcs_type: "bitbucket"
        }
      },
      repo_webHookId: "My_Webhook_Id"
    });

    mockedRequest.body = {};

    mockedNext = (err) => {
      should.exist(err);
      err.should.be.an.instanceof(Error);
      err.message.should.be.equal('BitBucket webhook message failed validation of its Webhook.');
      mockedRequest.db.models.project.get.calledOnce.should.be.true();
      mockedResponse.send.called.should.be.false();
      done();
    };

    controller.bitbucketWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });

  it('Can reject webhook for invalid payload on repo:push', (done) => {
    mockedRequest.headers['x-event-key'] = 'repo:push';
    mockedRequest.headers['x-hook-uuid'] = 'My_Webhook_Id';
    mockedRequest.db.models.project.get.callsArgWith(1, null, {
      repo_secret: 'foobar',
      repo_webHookId: "My_Webhook_Id",
      vcs: {
        vcs_type: {
          vcs_type: 'bitbucket'
        }
      }
    });

    mockedRequest.body = CommitPayload;

    mockedNext = (err) => {
      should.exist(err);
      err.should.be.an.instanceof(Error);
      err.message.should.be.equal('BitBucket webhook message failed validation of its Hmac, Payload, and Branch.');
      mockedRequest.db.models.project.get.calledOnce.should.be.true();
      mockedResponse.send.called.should.be.false();
      done();
    };

    controller.bitbucketWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });

  it('Can reject webhook for invalid branch on repo:push', (done) => {
    mockedRequest.headers['x-event-key'] = 'repo:push';
    mockedRequest.headers['x-hook-uuid'] = 'My_Webhook_Id';
    mockedRequest.db.models.project.get.callsArgWith(1, null, {
      repo_secret: 'foobar',
      repo_branch: "something_unexpected",
      repo_webHookId: "My_Webhook_Id",
      vcs: {
        vcs_type: {
          vcs_type: 'bitbucket'
        }
      }
    });

    mockedRequest.body = PushWebHookPayload;

    mockedNext = (err) => {
      should.exist(err);
      err.should.be.an.instanceof(Error);
      err.message.should.be.equal('BitBucket webhook message failed validation of its Hmac, Payload, and Branch.');
      mockedRequest.db.models.project.get.calledOnce.should.be.true();
      mockedResponse.send.called.should.be.false();
      done();
    };

    controller.bitbucketWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });
});
