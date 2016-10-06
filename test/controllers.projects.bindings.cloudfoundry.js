var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  httpStatus = require('http-status-codes'),
  rewire = require('rewire'),
  utils = require('../utils'),
  controller = rewire('../app/v2/projects/bindings/cloudfoundry/controller.js');

describe('v2/projects/bindings/cloudfoundry/controller', () => {
  var mockedRequest, mockedResponse, mockedNext, mockedProject, mockedDeploymentTarget, mockedActuators;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });
  });

  beforeEach(() => {
    mockedActuators = {};
    mockedActuators.cloudfoundry = {};
    mockedActuators.cloudfoundry.createBinding = sinon.stub();
    controller.__set__('actuators', mockedActuators);

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

    mockedRequest = {
      logger: utils.logger,
      params: {
        project_id: 1
      },
      body: {
        execution_id: 1337,
        cf_app_guid: 'cfapp-guid-1234'
      },
      db: {
        models: {
          project: {
            get: sinon.stub()
          }
        }
      }
    };

    mockedResponse = {
      send: sinon.stub(),
      status: sinon.stub()
    };

    mockedResponse.status.returns(mockedResponse);

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');
  });

  describe('createBinding', () => {
    it('should create a new service binding', (done) => {
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedDeploymentTarget);
      mockedActuators.cloudfoundry.createBinding.callsArgWith(5, null, {
        service_guid: 'mocked guid',
        app_guid: 'mocked guid'
      });

      mockedResponse.send = (payload) => {
        mockedResponse.status.calledWith(201).should.be.true();
        done();
      };

      controller.createBinding(mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle errors creating service bindings', (done) => {
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedDeploymentTarget);
      mockedActuators.cloudfoundry.createBinding.callsArgWith(5, mockedError, null);

      mockedNext = (err) => {
        err.should.be.an.instanceof(Error);
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.createBinding(mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle ORM errors', (done) => {
      mockedRequest.db.models.project.get.callsArgWith(1, null, null);

      mockedNext = (err) => {
        err.should.be.an.instanceof(Error);
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.createBinding(mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle ORM errors', (done) => {
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getDeploymentTarget.callsArgWith(0, null, null);

      mockedNext = (err) => {
        err.should.be.an.instanceof(Error);
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.createBinding(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
