var _ = require('lodash'),
  async = require('async'),
  request = require('request'),
  utils = require('../../utils');

exports.createBinding = function createBinding(deploymentTarget, cfAppId, projectId, executionId, logger, done) {
  return async.waterfall([
    (callback) => callback(null, deploymentTarget, logger),
    getAuthorizedRequestHandler,
    getAppInfo,
    createService
  ], done);

  function getAppInfo(requestWithAuth, callback) {
    logger.debug('Getting CloudFoundry App info.');
    requestWithAuth({
      url: `${deploymentTarget.url}/v2/apps/${cfAppId}/summary`,
      method: 'GET'
    }, (err, parsedBody) => {
      return callback(err, requestWithAuth, parsedBody);
    });
  }

  function createService(requestWithAuth, appInfo, callback) {
    var existingService = _.filter(appInfo.services, (service) => service.name === `foo-${cfAppId}`)[0];

    if (existingService) {
      // service is already bound, just update it
      updateService(existingService);
    } else {
      async.waterfall([
        createService,
        bindService
      ], (err, newServiceResult) => {
        if (err) {
          return callback(err);
        }

        return callback(null, {
          service_guid: newServiceResult.metadata.guid,
          app_guid: cfAppId
        });
      });
    }

    function updateService(existingService) {
      logger.debug(`Found existing service ${existingService.guid}, proceeding to update it.`);
      var updatedService = {
        credentials: {
          foo_api_url: utils.settings.crest.publicUri,
          foo_execution_id: executionId,
          foo_pipeline_id: projectId
        }
      };

      requestWithAuth({
        url: `${deploymentTarget.url}/v2/user_provided_service_instances/${existingService.guid}`,
        method: 'PUT',
        json: updatedService
      }, (err, parsedBody) => {
        return callback(err, {
          service_guid: existingService.guid,
          app_guid: cfAppId
        });
      });
    }

    function createService(cb) {
      logger.debug('No existing user-provided-service found, creating a new one.');
      var newService = {
        name: `foo-${cfAppId}`,
        credentials: {
          foo_api_url: utils.settings.crest.publicUri,
          foo_execution_id: executionId,
          foo_pipeline_id: projectId
        },
        space_guid: appInfo.space_guid
      };

      requestWithAuth({
        url: `${deploymentTarget.url}/v2/user_provided_service_instances`,
        method: 'POST',
        json: newService
      }, (err, createdService) => {
        return cb(err, createdService);
      });
    }

    function bindService(createdService, cb) {
      logger.debug('Binding the service.');
      requestWithAuth({
        url: `${deploymentTarget.url}/v2/service_bindings`,
        method: 'POST',
        json: {
          app_guid: cfAppId,
          service_instance_guid: createdService.metadata.guid
        }
      }, cb);
    }
  }
}

// Perform a cleanup, and remove all 'foo-*' services that aren't bound to an app.
exports.deleteUnboundServices = function deleteUnboundServices(deploymentTarget, cfAppId, logger, done) {
  return async.waterfall([
    (callback) => callback(null, deploymentTarget, logger),
    getAuthorizedRequestHandler,
    getAppInfo,
    getUnboundServices,
    deleteUnboundServices
  ], done);

  function getAppInfo(requestWithAuth, callback) {
    logger.debug('Getting CloudFoundry App info.');
    requestWithAuth({
      url: `${deploymentTarget.url}/v2/apps/${cfAppId}/summary`,
      method: 'GET'
    }, (err, parsedBody) => {
      return callback(err, requestWithAuth, parsedBody);
    });
  }

  function getUnboundServices(requestWithAuth, appInfo, callback) {
    var regex = /^(foo-)[\w\-]+/;

    requestWithAuth({
      url: `${deploymentTarget.url}/v2/spaces/${appInfo.space_guid}/summary`,
      method: 'GET'
    }, (err, parsedBody) => {
      if (err) {
        return callback(err);
      }

      var unboundServices = _.filter(parsedBody.services, service => regex.test(service.name) && service.bound_app_count === 0);
      return callback(null, requestWithAuth, unboundServices);
    });
  }

  function deleteUnboundServices(requestWithAuth, unboundServices, callback) {
    var serviceFunctions = unboundServices.map((service) => {
      return (cb) => {
        requestWithAuth({
          url: `${deploymentTarget.url}/v2/service_instances/${service.guid}`,
          method: 'DELETE'
        }, cb);
      }
    });

    async.parallel(serviceFunctions, callback);
  }
}

// Calls the callback with (Error err, Function authorizedRequest).
// The function can be used to make authorized requests to the CF endpoint.
function getAuthorizedRequestHandler(deploymentTarget, logger, callback) {
  async.waterfall([getCloudFoundryInfo, authenticate], (err, token) => {
    if (err) {
      return callback(err);
    }

    return callback(null, authorizedRequest);

    // By returning this handler in a closure, we can be certain that
    // there won't be situations where requests can be made with the
    // wrong token value. It also provides safety in that we don't pass
    // tokens around the application.
    function authorizedRequest(options, callback) {
      options.headers = options.headers || {};
      options.headers.Authorization = `bearer ${token}`;
      options.rejectUnauthorized = false;
      options.json = options.json || true;

      request(options, (err, response, body) => {
        if (err || !(response.statusCode >= 200 && response.statusCode < 300)) {
          err = err || new Error(`Unable to action ${options.method}: ${options.url} - response: ${response.statusCode}`);
          logger.error('Error making authorized request to CF', err);
          return callback(err);
        }

        return callback(null, body);
      });
    }
  });

  function getCloudFoundryInfo(callback) {
    logger.debug('Getting CloudFoundry endpoint info.');
    request({
      url: `${deploymentTarget.url}/v2/info`,
      method: 'GET',
      json: true,
      rejectUnauthorized: false
    }, (err, response, body) => {
      if (err || !response.statusCode === 200) {
        err = err || new Error(`Unable to action GET: ${deploymentTarget.url}/v2/info - response: ${response.statusCode}`);
        logger.error('Error making authorized request to CF', err);
        return callback(err);
      }

      callback(null, body);
    });
  }

  function authenticate(cfInfo, callback) {
    logger.debug('Authenticating with CloudFoundry endpoint.');
    request({
      url: `${cfInfo.authorization_endpoint}/oauth/token`,
      method: 'POST',
      rejectUnauthorized: false,
      json: true,
      form: {
        grant_type: 'password',
        username: deploymentTarget.userName,
        password: deploymentTarget.password
      },
      headers: {
        authorization: 'Basic Y2Y6=='
      }
    }, (err, response, body) => {
      if (err || response.statusCode !== 200) {
        err = err || new Error(`Unable to action POST: ${cfInfo.authorization_endpoint}/oauth/token - response: ${response.statusCode}`);
        logger.error('Error making authorized request to CF', err);
        return callback(err);
      }

      callback(null, body.access_token);
    });
  }
}
