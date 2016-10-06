var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  utils = require('../utils'),
  cfActuator = rewire('../utils/actuators/cloudfoundry.js');

describe('actuators/cloudfoundry', () => {
  var mockedDeploymentTarget, mockedCreatedService, mockedRequest;
  var okResponse, createdResponse, deletedResponse;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    okResponse = {
      statusCode: 200
    };

    createdResponse = {
      statusCode: 201
    };

    deletedResponse = {
      statusCode: 204
    }
  });

  beforeEach(() => {
    mockedRequest = sinon.stub();
    cfActuator.__set__('request', mockedRequest);

    mockedDeploymentTarget = {
      id: '1',
      url: 'mycf.com',
      type: 'cloudfoundry',
      userName: 'myUsername',
      password: 'myPassword',
      find: sinon.stub()
    };

    mockedCreatedService = {
      metadata: {
        guid: 'created-service-guid'
      }
    };

    mockedError = new Error('Mocked Error');
  });

  describe('createBinding', () => {
    it('should create a new service binding', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, null, okResponse, {
        authorization_endpoint: 'login.mycf.com'
      });

      mockedRequest.onCall(1).callsArgWith(1, null, okResponse, {
        access_token: 'your-secret-token'
      });

      mockedRequest.onCall(2).callsArgWith(1, null, okResponse, {
        space_guid: 'the-app-space-guid',
        services: []
      });

      mockedRequest.onCall(3).callsArgWith(1, null, createdResponse, mockedCreatedService);
      mockedRequest.onCall(4).callsArgWith(1, null, createdResponse, mockedCreatedService);

      cfActuator.createBinding(mockedDeploymentTarget, 'cfapp-guid-1234', 1, 1337, utils.logger, (err, service) => {
        should.not.exist(err);
        service.service_guid.should.equal('created-service-guid');
        service.app_guid.should.equal('cfapp-guid-1234');

        mockedRequest.getCall(0).args[0].url.should.equal('mycf.com/v2/info');
        mockedRequest.getCall(0).args[0].method.should.equal('GET');

        mockedRequest.getCall(1).args[0].url.should.equal('login.mycf.com/oauth/token');
        mockedRequest.getCall(1).args[0].method.should.equal('POST');
        mockedRequest.getCall(1).args[0].form.username.should.equal('myUsername');
        mockedRequest.getCall(1).args[0].form.password.should.equal('myPassword');
        mockedRequest.getCall(1).args[0].form.grant_type.should.equal('password');

        mockedRequest.getCall(2).args[0].url.should.equal('mycf.com/v2/apps/cfapp-guid-1234/summary');
        mockedRequest.getCall(2).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(2).args[0].method.should.equal('GET');

        mockedRequest.getCall(3).args[0].url.should.equal('mycf.com/v2/user_provided_service_instances');
        mockedRequest.getCall(3).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(3).args[0].method.should.equal('POST');
        mockedRequest.getCall(3).args[0].json.name.should.equal('foo-cfapp-guid-1234');
        mockedRequest.getCall(3).args[0].json.credentials.foo_api_url.should.equal(utils.settings.crest.publicUri);
        mockedRequest.getCall(3).args[0].json.credentials.foo_execution_id.should.equal(1337);
        mockedRequest.getCall(3).args[0].json.credentials.foo_pipeline_id.should.equal(1);

        mockedRequest.getCall(4).args[0].url.should.equal('mycf.com/v2/service_bindings');
        mockedRequest.getCall(4).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(4).args[0].method.should.equal('POST');
        mockedRequest.getCall(4).args[0].json.app_guid.should.equal('cfapp-guid-1234');
        mockedRequest.getCall(4).args[0].json.service_instance_guid.should.equal('created-service-guid');

        done();
      });
    });

    it('should update an existing service binding', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, null, okResponse, {
        authorization_endpoint: 'login.mycf.com'
      });

      mockedRequest.onCall(1).callsArgWith(1, null, okResponse, {
        access_token: 'your-secret-token'
      });

      mockedRequest.onCall(2).callsArgWith(1, null, okResponse, {
        space_guid: 'the-app-space-guid',
        services: [{
          guid: 'existing-service-guid',
          name: 'foo-cfapp-guid-1234'
        }]
      });

      mockedRequest.onCall(3).callsArgWith(1, null, createdResponse, {});

      cfActuator.createBinding(mockedDeploymentTarget, 'cfapp-guid-1234', 1, 1337, utils.logger, (err, service) => {
        should.not.exist(err);
        service.service_guid.should.equal('existing-service-guid');
        service.app_guid.should.equal('cfapp-guid-1234');

        mockedRequest.getCall(0).args[0].url.should.equal('mycf.com/v2/info');
        mockedRequest.getCall(0).args[0].method.should.equal('GET');

        mockedRequest.getCall(1).args[0].url.should.equal('login.mycf.com/oauth/token');
        mockedRequest.getCall(1).args[0].method.should.equal('POST');
        mockedRequest.getCall(1).args[0].form.username.should.equal('myUsername');
        mockedRequest.getCall(1).args[0].form.password.should.equal('myPassword');
        mockedRequest.getCall(1).args[0].form.grant_type.should.equal('password');

        mockedRequest.getCall(2).args[0].url.should.equal('mycf.com/v2/apps/cfapp-guid-1234/summary');
        mockedRequest.getCall(2).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(2).args[0].method.should.equal('GET');

        mockedRequest.getCall(3).args[0].url.should.equal('mycf.com/v2/user_provided_service_instances/existing-service-guid');
        mockedRequest.getCall(3).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(3).args[0].method.should.equal('PUT');
        mockedRequest.getCall(3).args[0].json.credentials.foo_api_url.should.equal(utils.settings.crest.publicUri);
        mockedRequest.getCall(3).args[0].json.credentials.foo_execution_id.should.equal(1337);
        mockedRequest.getCall(3).args[0].json.credentials.foo_pipeline_id.should.equal(1);

        done();
      });
    });

    it('should handle network issues reaching the cloud-foundry endpoint', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, mockedError, null, null);

      cfActuator.createBinding(mockedDeploymentTarget, 'cfapp-guid-1234', 1, 1337, utils.logger, (err, service) => {
        err.should.be.an.instanceof(Error);
        done();
      });
    });

    it('should handle authentication failures', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, null, okResponse, {
        authorization_endpoint: 'login.mycf.com'
      });

      mockedRequest.onCall(1).callsArgWith(1, null, {
        statusCode: 401
      }, {});

      cfActuator.createBinding(mockedDeploymentTarget, 'cfapp-guid-1234', 1, 1337, utils.logger, (err, service) => {
        err.should.be.an.instanceof(Error);
        done();
      });
    });

    it('should handle authenticated request errors', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, null, okResponse, {
        authorization_endpoint: 'login.mycf.com'
      });

      mockedRequest.onCall(1).callsArgWith(1, null, okResponse, {
        access_token: 'your-secret-token'
      });

      mockedRequest.onCall(2).callsArgWith(1, null, {
        statusCode: 401
      }, null);

      cfActuator.createBinding(mockedDeploymentTarget, 'cfapp-guid-1234', 1, 1337, utils.logger, (err, service) => {
        err.should.be.an.instanceof(Error);
        done();
      });
    });

    it('should handle errors fetching an exitsing service', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, null, okResponse, {
        authorization_endpoint: 'login.mycf.com'
      });

      mockedRequest.onCall(1).callsArgWith(1, null, okResponse, {
        access_token: 'your-secret-token'
      });

      mockedRequest.onCall(2).callsArgWith(1, null, okResponse, {
        space_guid: 'the-app-space-guid'
      });

      mockedRequest.onCall(3).callsArgWith(1, mockedError);

      cfActuator.createBinding(mockedDeploymentTarget, 'cfapp-guid-1234', 1, 1337, utils.logger, (err, service) => {
        err.should.be.an.instanceof(Error);
        done();
      });
    });

    it('should handle errors creating a new service binding', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, null, okResponse, {
        authorization_endpoint: 'login.mycf.com'
      });

      mockedRequest.onCall(1).callsArgWith(1, null, okResponse, {
        access_token: 'your-secret-token'
      });

      mockedRequest.onCall(2).callsArgWith(1, null, okResponse, {
        space_guid: 'the-app-space-guid',
        services: []
      });

      // It may be that the service already exists but isn't bound. This will happen if the customer
      // or another party tries to manually create the service. Trying to handle these interference
      // cases is outside the scope of this controller.
      mockedRequest.onCall(3).callsArgWith(1, null, {
        statusCode: 400
      }, 'Service already exists');

      cfActuator.createBinding(mockedDeploymentTarget, 'cfapp-guid-1234', 1, 1337, utils.logger, (err, service) => {
        err.should.be.an.instanceof(Error);
        done();
      });
    });
  });

  describe('deleteUnboundServices', () => {
    it('should delete all foo-* services with 0 binding count', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, null, okResponse, {
        authorization_endpoint: 'login.mycf.com'
      });

      mockedRequest.onCall(1).callsArgWith(1, null, okResponse, {
        access_token: 'your-secret-token'
      });

      mockedRequest.onCall(2).callsArgWith(1, null, okResponse, {
        space_guid: 'the-app-space-guid',
        services: []
      });

      mockedRequest.onCall(3).callsArgWith(1, null, okResponse, {
        services: [{
          guid: 'delete-me-guid',
          name: 'foo-some-guid-1234',
          bound_app_count: 0
        }, {
          guid: 'dont-delete-me-guid',
          name: 'foo-some-other-guid-4567',
          bound_app_count: 1
        }, {
          guid: 'dont-delete-me-either-guid',
          name: 'not-an-foo-app',
          bound_app_count: 0
        }]
      });

      mockedRequest.onCall(4).callsArgWith(1, null, deletedResponse, null);

      cfActuator.deleteUnboundServices(mockedDeploymentTarget, 'cfapp-guid-1234', utils.logger, (err) => {
        should.not.exist(err);
        mockedRequest.callCount.should.equal(5);

        mockedRequest.getCall(0).args[0].url.should.equal('mycf.com/v2/info');
        mockedRequest.getCall(0).args[0].method.should.equal('GET');

        mockedRequest.getCall(1).args[0].url.should.equal('login.mycf.com/oauth/token');
        mockedRequest.getCall(1).args[0].method.should.equal('POST');
        mockedRequest.getCall(1).args[0].form.username.should.equal('myUsername');
        mockedRequest.getCall(1).args[0].form.password.should.equal('myPassword');
        mockedRequest.getCall(1).args[0].form.grant_type.should.equal('password');

        mockedRequest.getCall(2).args[0].url.should.equal('mycf.com/v2/apps/cfapp-guid-1234/summary');
        mockedRequest.getCall(2).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(2).args[0].method.should.equal('GET');

        mockedRequest.getCall(3).args[0].url.should.equal('mycf.com/v2/spaces/the-app-space-guid/summary');
        mockedRequest.getCall(3).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(3).args[0].method.should.equal('GET');

        mockedRequest.getCall(4).args[0].url.should.equal('mycf.com/v2/service_instances/delete-me-guid');
        mockedRequest.getCall(4).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(4).args[0].method.should.equal('DELETE');

        done();
      });
    });

    it('should not delete anything if theres nothing to delete', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, null, okResponse, {
        authorization_endpoint: 'login.mycf.com'
      });

      mockedRequest.onCall(1).callsArgWith(1, null, okResponse, {
        access_token: 'your-secret-token'
      });

      mockedRequest.onCall(2).callsArgWith(1, null, okResponse, {
        space_guid: 'the-app-space-guid',
        services: []
      });

      mockedRequest.onCall(3).callsArgWith(1, null, okResponse, {
        services: [{
          guid: 'dont-delete-me-guid',
          name: 'foo-some-other-guid-4567',
          bound_app_count: 1
        }, {
          guid: 'dont-delete-me-either-guid',
          name: 'not-an-foo-app',
          bound_app_count: 0
        }]
      });

      cfActuator.deleteUnboundServices(mockedDeploymentTarget, 'cfapp-guid-1234', utils.logger, (err) => {
        should.not.exist(err);
        mockedRequest.callCount.should.equal(4);

        mockedRequest.getCall(0).args[0].url.should.equal('mycf.com/v2/info');
        mockedRequest.getCall(0).args[0].method.should.equal('GET');

        mockedRequest.getCall(1).args[0].url.should.equal('login.mycf.com/oauth/token');
        mockedRequest.getCall(1).args[0].method.should.equal('POST');
        mockedRequest.getCall(1).args[0].form.username.should.equal('myUsername');
        mockedRequest.getCall(1).args[0].form.password.should.equal('myPassword');
        mockedRequest.getCall(1).args[0].form.grant_type.should.equal('password');

        mockedRequest.getCall(2).args[0].url.should.equal('mycf.com/v2/apps/cfapp-guid-1234/summary');
        mockedRequest.getCall(2).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(2).args[0].method.should.equal('GET');

        mockedRequest.getCall(3).args[0].url.should.equal('mycf.com/v2/spaces/the-app-space-guid/summary');
        mockedRequest.getCall(3).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(3).args[0].method.should.equal('GET');

        done();
      });
    });

    it('should handle errors getting the list of unbound services', (done) => {
      mockedRequest.onCall(0).callsArgWith(1, null, okResponse, {
        authorization_endpoint: 'login.mycf.com'
      });

      mockedRequest.onCall(1).callsArgWith(1, null, okResponse, {
        access_token: 'your-secret-token'
      });

      mockedRequest.onCall(2).callsArgWith(1, null, okResponse, {
        space_guid: 'the-app-space-guid',
        services: []
      });

      mockedRequest.onCall(3).callsArgWith(1, mockedError, null, null);

      cfActuator.deleteUnboundServices(mockedDeploymentTarget, 'cfapp-guid-1234', utils.logger, (err) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);

        mockedRequest.callCount.should.equal(4);

        mockedRequest.getCall(0).args[0].url.should.equal('mycf.com/v2/info');
        mockedRequest.getCall(0).args[0].method.should.equal('GET');

        mockedRequest.getCall(1).args[0].url.should.equal('login.mycf.com/oauth/token');
        mockedRequest.getCall(1).args[0].method.should.equal('POST');
        mockedRequest.getCall(1).args[0].form.username.should.equal('myUsername');
        mockedRequest.getCall(1).args[0].form.password.should.equal('myPassword');
        mockedRequest.getCall(1).args[0].form.grant_type.should.equal('password');

        mockedRequest.getCall(2).args[0].url.should.equal('mycf.com/v2/apps/cfapp-guid-1234/summary');
        mockedRequest.getCall(2).args[0].headers.Authorization.should.equal('bearer your-secret-token');
        mockedRequest.getCall(2).args[0].method.should.equal('GET');

        done();
      });
    });
  });
});
