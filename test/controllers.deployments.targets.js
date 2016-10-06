var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  controller = require('../app/v2/deployments/targets/controller.js');

describe('v2/deployment/targets/controller', () => {
  var mockedRequest, mockedResponse, mockedNext,
    mockedDB, mockedDeploymentTarget, mockedError;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    mockedDB = {}
    mockedDB.models = {
      deploymentTarget: {
        exists: sinon.stub().callsArgWith(1, null, false)
      }
    };

    utils.database.connection = sinon.stub().callsArgWith(0, null, mockedDB)

    utils.database.connection.encryptValue = (value) => {
      return `encrypted_${value}`;
    };
  });

  beforeEach(() => {
    mockedRequest = {
      logger: utils.logger,
      db: {
        models: {
          deploymentTarget: {
            create: sinon.stub(),
            get: sinon.stub(),
            find: sinon.stub()
          }
        }
      },
      body: {
        name: 'Deployment Target Name',
        url: 'http://www.example.com/',
        userName: 'username',
        password: 'password',
        organization: 'org 1',
        space: 'space 1',
        type: 'cloudfoundry'
      },
      params: {
        target_id: 1
      },
      query: {
        user_id: 2
      }
    };

    mockedResponse = {
      send: sinon.stub(),
      status: sinon.stub()
    };

    mockedDeploymentTarget = {
      id: 1,
      name: 'Test Target',
      remove: sinon.stub(),
      save: sinon.stub(),
      getProjects: sinon.stub()
    };

    mockedRequest.user = {
      user_id: 1
    }

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');
  });

  describe('createTarget', () => {
    it('should create a deployment target', (done) => {
      mockedRequest.db.models.deploymentTarget.create.callsArgWith(1, null, mockedDeploymentTarget);
      mockedResponse.status.returns(mockedResponse);

      mockedResponse.send = (payload) => {
        payload.should.equal(mockedDeploymentTarget);
        mockedNext.called.should.be.false();
        mockedResponse.status.calledWith(httpStatus.CREATED).should.be.true();
        done();
      };
      controller.createTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when no target name is supplied', (done) => {
      mockedRequest.body.name = null;
      mockedNext = (err) => {
        err.should.be.an.instanceof(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: name.');
        err.status.should.equal(400);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        mockedRequest.body.name = "Deployment target";
        done();
      };
      controller.createTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error on duplicate target name', (done) => {
      mockedRequest.body.name = "duplicate name";
      mockedDB.models.deploymentTarget.exists.callsArgWith(1, null, true);
      mockedNext = (err) => {
        err.should.be.an.instanceof(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: name.');
        err.status.should.equal(400);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.createTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when no target organization is supplied', (done) => {
      mockedRequest.body.organization = null;
      mockedRequest.body.name = "Target one";
      mockedNext = (err) => {
        err.should.be.an.instanceof(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: organization.');
        err.status.should.equal(400);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.createTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when no target space is supplied', (done) => {
      mockedRequest.body.space = null;

      mockedNext = (err) => {
        err.should.be.an.instanceof(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: space.');
        err.status.should.equal(400);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.createTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when no target userName is supplied', (done) => {
      mockedRequest.body.userName = null;

      mockedNext = (err) => {
        err.should.be.an.instanceof(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: userName.');
        err.status.should.equal(400);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.createTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when no target password is supplied', (done) => {
      mockedRequest.body.password = null;

      mockedNext = (err) => {
        err.should.be.an.instanceof(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: password.');
        err.status.should.equal(400);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.createTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when target fails to create', (done) => {
      mockedRequest.db.models.deploymentTarget.create.callsArgWith(1, mockedError);
      mockedDB.models.deploymentTarget.exists.callsArgWith(1, null, false);
      mockedRequest.body = {
        name: 'Deployment Target Name',
        url: 'http://www.example.com/',
        userName: 'username',
        password: 'password',
        organization: 'org 1',
        space: 'space 1',
        type: 'cloudfoundry'
      };
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.createTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when target fails to create and no error is given by ORM', (done) => {
      mockedRequest.db.models.deploymentTarget.create.callsArgWith(1, null, null);
      mockedRequest.body.name = "Target one";
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no deploymentTarget.');
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.createTarget(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('deleteTarget', () => {
    it('should delete a deployment target', (done) => {
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedDeploymentTarget);
      mockedDeploymentTarget.getProjects.callsArgWith(0, null, null);
      mockedDeploymentTarget.remove.callsArgWith(0, null);
      mockedResponse.status.returns(mockedResponse);

      mockedResponse.send = () => {
        mockedNext.called.should.be.false();
        mockedResponse.status.calledWith(httpStatus.NO_CONTENT).should.be.true();
        done();
      };

      controller.deleteTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a target doesn\'t exist', (done) => {
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, null);

      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no target:${mockedRequest.params.target_id}`);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.deleteTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getting projects fails', (done) => {
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedDeploymentTarget);
      mockedDeploymentTarget.getProjects.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.deleteTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a target is on project(s)', (done) => {
      var mockedProjects = [{
        id: 1
      }];
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedDeploymentTarget);
      mockedDeploymentTarget.getProjects.callsArgWith(0, null, mockedProjects);

      mockedNext = (err) => {
        err.message.should.equal(`Cannot delete. ` +
          `The deployment target/target is still in use by ` +
          `${mockedProjects.length} project(s).`);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.deleteTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when removing a target fails', (done) => {
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedDeploymentTarget);
      mockedDeploymentTarget.getProjects.callsArgWith(0, null, null);
      mockedDeploymentTarget.remove.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.deleteTarget(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('updateTarget', () => {
    it('should update a target', (done) => {
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedDeploymentTarget);
      mockedDeploymentTarget.save.callsArgWith(0, null);

      mockedResponse.send = (payload) => {
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        payload.should.equal(mockedDeploymentTarget);
        done();
      };

      controller.updateTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail when params are invalid', (done) => {
      mockedRequest.body.password = null;

      mockedNext = (err) => {
        err.should.be.an.instanceof(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: password.');
        err.status.should.equal(400);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when get target fails', (done) => {
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, null);

      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no deployment target:${mockedRequest.params.target_id}`);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when target save fails', (done) => {
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedDeploymentTarget);
      mockedDeploymentTarget.save.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateTarget(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getTarget', () => {
    it('should get a target', (done) => {
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedDeploymentTarget);

      mockedResponse.send = (payload) => {
        payload.should.equal(mockedDeploymentTarget);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        done();
      };

      controller.getTarget(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when no target is found', (done) => {
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, null);

      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no target:${mockedRequest.params.target_id}`)
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getTarget(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getTargets', () => {
    it('should get targets for a user', (done) => {
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, [mockedDeploymentTarget]);

      mockedResponse.send = (payload) => {
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        payload.length.should.equal(1);
        payload[0].should.equal(mockedDeploymentTarget);
        done();
      }

      controller.getTargets(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when find fails', (done) => {
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      }

      controller.getTargets(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when ORM behaves unexpectedly', (done) => {
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, null);

      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error and no targets.');
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      }

      controller.getTargets(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
