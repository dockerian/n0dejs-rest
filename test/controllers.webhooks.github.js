var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  testHelpers = require('./_helpers.js'),
  controller = require('../app/v2/hooks/controller.js');

describe('v2/hooks/controller/github', () => {
  var mockedRequest, mockedResponse, mockedNext, mockEncryption;

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
        'x-github-event': 'ping'
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

  it('Can handle PING event', (done) => {
    mockedResponse.send = (data) => {
      data.should.be.equal('GitHub webhook PING received for project: 12');
      done();
    }

    controller.githubWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });

  it('Can handle error getting VCS Instance', (done) => {
    var project = {
      name: 'no_vcs_project',
      getVcs: sinon.stub().callsArgWith(1, null)
    };

    mockedResponse.send = (data) => {
      data.should.be.equal('GitHub webhook PING received for project: 12');
      done();
    }

    controller.getVCSInstance(project, {}, (err, project, commit) => {
      should.exist(err);
      err.message.should.be.equal("Unable to retrieve vcs for project no_vcs_project, no ORM error.");
      done();
    });
  });

  it('Can reject unknown event', (done) => {
    mockedRequest.headers['x-github-event'] = 'CUSTOM_ACTIOn';
    mockedRequest.body = {
      action: 'CUSTOM_ACTIOn'
    };

    mockedResponse.send = (data) => {
      data.should.be.equal('GitHub webhook event ignored for project: 12, [CUSTOM_ACTIOn:CUSTOM_ACTIOn]');
      done();
    }

    controller.githubWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });

  it('Can reject webhook for invalid project', (done) => {
    mockedRequest.body.action = 'push';
    mockedRequest.headers['x-github-event'] = 'push';
    mockedRequest.db.models.project.get.callsArgWith(1, null, null);

    mockedNext = (err) => {
      should.exist(err);
      err.should.be.an.instanceof(Error);

      mockedRequest.db.models.project.get.calledOnce.should.be.true();
      mockedResponse.send.called.should.be.false();
      done();
    };

    controller.githubWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });

  it('Can reject webhook for invalid HMAC signature on push', (done) => {
    mockedRequest.headers['x-github-event'] = 'push';
    mockedRequest.db.models.project.get.callsArgWith(1, null, {
      repo_secret: 'foobar'
    });

    utils.database.connection = {
      decryptValue: sinon.stub().returns("CLEAR_TEXT")
    };

    mockedRequest.body = {
      action: 'push',
      sender: {
        login: 'bbfoobar'
      },
      head_commit: {

      },
      ref: 'AS)*DASD',
      repository: {
        clone_url: 'https://github.com/bbfoobar/node-env'
      }
    };

    mockedNext = (err) => {
      should.exist(err);
      err.should.be.an.instanceof(Error);
      utils.database.connection.decryptValue.calledWith('foobar').should.be.true();
      utils.database.connection.decryptValue.calledOnce.should.be.true();
      err.message.should.be.equal('GitHub webhook message failed validation of its Hmac, Payload, and Branch.');
      mockedRequest.db.models.project.get.calledOnce.should.be.true();
      mockedResponse.send.called.should.be.false();
      done();
    };

    controller.githubWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });

  it('Can reject webhook for invalid HMAC signature on pull_request', (done) => {
    mockedRequest.headers['x-github-event'] = 'pull_request';
    mockedRequest.db.models.project.get.callsArgWith(1, null, {
      repo_secret: 'foobar'
    });

    mockedRequest.body = {
      action: 'opened',
      sender: {
        login: 'bbfoobar'
      },
      head_commit: {

      },
      pull_request: {
        mergeable: true,
        head: {
          sha: 'Shjlasd',
          repo: {
            full_name: 'FULL_NAME',
            clone_url: 'https://github.com/bbfoobar/node-env'
          }
        },
        base: {
          repo: {
            full_name: 'FULL_NAME',
            clone_url: 'https://github.com/bbfoobar/node-env'
          }
        }
      },
      ref: 'AS)*DASD',
      repository: {
        clone_url: 'https://github.com/bbfoobar/node-env'
      }
    };

    mockedNext = (err) => {
      should.exist(err);
      err.should.be.an.instanceof(Error);
      err.message.should.equal('GitHub webhook message failed validation of its Hmac, Payload, and Branch.');
      mockedResponse.send.called.should.be.false();
      done();
    }

    controller.githubWebhookHandler(mockedRequest, mockedResponse, mockedNext);
  });
});
