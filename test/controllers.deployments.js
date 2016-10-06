var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  rewire = require('rewire'),
  controller = rewire('../app/v2/deployments/controller.js');

describe('v2/deployments/controller', () => {
  var mockedRequest, mockedResponse, mockedNext, mockedDeployment, mockedError, mockedBuild, mockedActuators;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    utils.database.connection.encryptValue = (value) => {
      return `encrypted_${value}`;
    };
  });

  beforeEach(() => {
    mockedActuators = {};
    mockedActuators.cloudfoundry = {};
    mockedActuators.cloudfoundry.createBinding = sinon.stub();
    mockedActuators.cloudfoundry.deleteUnboundServices = sinon.stub();
    controller.__set__('actuators', mockedActuators);

    mockedRequest = {
      logger: utils.logger,
      params: {
        deployment_id: 1
      },
      query: {
        build_id: 2
      },
      body: {
        build_id: 2,
        name: 'deployment name'
      },
      db: {
        driver: {
          execQuery: sinon.stub()
        },
        models: {
          deployment: {
            get: sinon.stub(),
            remove: sinon.stub(),
            find: sinon.stub(),
            create: sinon.stub()
          },
          build: {
            get: sinon.stub()
          },
          project: {
            get: sinon.stub()
          }
        }
      }
    };

    mockedProject = {
      getDeploymentTarget: sinon.stub()
    }

    mockedDeploymentTarget = {
      id: '1',
      url: 'mycf.com',
      type: 'cloudfoundry',
      username: 'myUsername',
      password: 'myPassword',
      find: sinon.stub()
    };

    mockedDeployment = {
      id: 1
    };

    mockedBuild = {
      id: 2,
      reason_type: 'not_pull_request'
    };

    mockedBuild1 = {
      id: 3,
      reason_type: 'pull_request'
    };

    mockedResponse = {
      send: sinon.stub(),
      status: sinon.stub()
    };

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');
  });

  describe('getDeployment', () => {
    it('should get a deployment', (done) => {
      mockedRequest.db.models.deployment.get.callsArgWith(1, null, mockedDeployment);

      mockedResponse.send = (payload) => {
        mockedRequest.db.models.deployment.get.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        done();
      };

      controller.getDeployment(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when it fails to get a deployment', (done) => {
      mockedRequest.db.models.deployment.get.callsArgWith(1, null, null);

      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no deployment:1`)
        mockedRequest.db.models.deployment.get.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getDeployment(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getDeploymentsForExecution', () => {
    it('should successfully get deployments for a build', (done) => {
      var mockedDeployment = {
        id: 1,
        name: 'test'
      };

      mockedRequest.db.models.deployment.find.callsArgWith(1, null, [mockedDeployment]);

      mockedResponse.send = (deployments) => {
        mockedNext.called.should.be.false();
        deployments.length.should.equal(1);
        deployments[0].id.should.equal(1);
        done();
      };

      controller.getDeploymentsForExecution(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when there is no build id', (done) => {
      mockedRequest.query.build_id = null;

      mockedNext = (err) => {
        err.message.should.equal('build_id filter is required but not provided in query.');
        err.status.should.equal(httpStatus.BAD_REQUEST);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.getDeploymentsForExecution(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when finding deployments fails', (done) => {
      mockedRequest.db.models.deployment.find.callsArgWith(1, mockedError, null);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.getDeploymentsForExecution(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('createDeployment', () => {
    it('should create a deployment', (done) => {
      mockedRequest.db.models.deployment.create.callsArgWith(1, null, mockedDeployment);
      mockedRequest.db.models.build.get.callsArgWith(1, null, mockedBuild);
      mockedRequest.db.driver.execQuery.callsArgWith(2, null);

      mockedResponse.status.returns(mockedResponse);

      mockedResponse.send = (payload) => {
        mockedResponse.status.calledWith(httpStatus.CREATED);
        mockedResponse.status.calledOnce.should.be.true();
        payload.should.be.equal(mockedDeployment);

        mockedActuators.cloudfoundry.createBinding.called.should.be.false();
        mockedActuators.cloudfoundry.deleteUnboundServices.called.should.be.false();

        done();
      };

      controller.createDeployment(mockedRequest, mockedResponse, mockedNext);
    });

    it('should create a deployment and a cf binding', (done) => {
      mockedRequest.body.application_guid = 'test_guid';
      mockedRequest.db.models.deployment.create.callsArgWith(1, null, mockedDeployment);
      mockedRequest.db.models.build.get.callsArgWith(1, null, mockedBuild);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.driver.execQuery.callsArgWith(2, null);
      mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedDeploymentTarget);
      mockedActuators.cloudfoundry.createBinding.callsArgWith(5, null, {});
      mockedActuators.cloudfoundry.deleteUnboundServices.callsArgWith(3, null, null);

      mockedResponse.status.returns(mockedResponse);

      mockedResponse.send = (payload) => {
        mockedResponse.status.calledWith(httpStatus.CREATED);
        mockedResponse.status.calledOnce.should.be.true();
        payload.should.be.equal(mockedDeployment);
        done();
      };

      controller.createDeployment(mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle errors when it cannot get a create a binding', (done) => {
      mockedRequest.body.application_guid = 'test_guid';
      mockedRequest.db.models.deployment.create.callsArgWith(1, null, mockedDeployment);
      mockedRequest.db.models.build.get.callsArgWith(1, null, mockedBuild);
      mockedRequest.db.models.project.get.callsArgWith(1, mockedError, null);
      mockedRequest.db.driver.execQuery.callsArgWith(2, null);
      mockedResponse.status.returns(mockedResponse);

      mockedResponse.send = (payload) => {
        mockedResponse.status.calledWith(httpStatus.CREATED);
        mockedResponse.status.calledOnce.should.be.true();
        payload.should.be.equal(mockedDeployment);

        mockedActuators.cloudfoundry.createBinding.called.should.be.false();
        mockedActuators.cloudfoundry.deleteUnboundServices.called.should.be.false();
        done();
      };

      controller.createDeployment(mockedRequest, mockedResponse, mockedNext);
    });

    it('should create a pull_request deployment', (done) => {
      mockedRequest.db.models.deployment.create.callsArgWith(1, null, mockedDeployment);
      mockedRequest.db.models.build.get.callsArgWith(1, null, mockedBuild1);
      mockedResponse.status.returns(mockedResponse);

      mockedResponse.send = (payload) => {
        mockedResponse.status.calledWith(httpStatus.CREATED);
        mockedResponse.status.calledOnce.should.be.true();
        payload.should.be.equal(mockedDeployment);
        done();
      };

      controller.createDeployment(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when there is no build id', (done) => {
      mockedRequest.body.build_id = null;
      mockedRequest.db.models.build.get.callsArgWith(1, {
          message: "build_id is required but not provided in post body.",
          status: httpStatus.BAD_REQUEST
        },
        null);

      mockedNext = (err) => {
        mockedResponse.status.calledOnce.should.be.false();
        mockedResponse.send.calledOnce.should.be.false();
        err.message.should.equal('build_id is required but not provided in post body.');
        err.status.should.equal(httpStatus.BAD_REQUEST);

        mockedActuators.cloudfoundry.createBinding.called.should.be.false();
        mockedActuators.cloudfoundry.deleteUnboundServices.called.should.be.false();

        done();
      };

      controller.createDeployment(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a deployment fails to create', (done) => {
      mockedRequest.db.models.deployment.create.callsArgWith(1, null, null);
      mockedRequest.db.models.build.get.callsArgWith(1, null, mockedBuild);
      mockedRequest.db.driver.execQuery.callsArgWith(2, null);

      mockedNext = (err) => {
        mockedResponse.status.calledOnce.should.be.false();
        mockedResponse.send.calledOnce.should.be.false();
        err.message.should.equal(`ORM returned no error, and no deployment for build:2`);

        mockedActuators.cloudfoundry.createBinding.called.should.be.false();
        mockedActuators.cloudfoundry.deleteUnboundServices.called.should.be.false();

        done();
      };

      controller.createDeployment(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
