var middleware = require('./middleware.js'),
  v1 = require('./v1'),
  v2 = require('./v2'),
  status = require('./status'),
  deploymentController = require('./v2/deployments/controller'),
  webhooksController = require('./v2/hooks/controller'),
  utils = require('../utils'),
  api = require('express')();

module.exports = api;

api.use(middleware.requestId);
api.use(middleware.logger);

// unauthenticated routes
api.get('/info', middleware.serviceInfo);
api.get('/v2/swagger', (req, res) => {
  res.sendFile(`${__dirname}/v2/swagger.yml`);
})


// authenticated routes
api.use(middleware.database);
api.use(middleware.bodyParser);
api.use(middleware.serializer);

// This will *ALWAYS* be unauthenticated because we can't configure GitHub or bitbucket
// to authenticate with us before firing webhooks.
api.post('/v2/hooks/github/:project_id', webhooksController.githubWebhookHandler);
api.post('/v2/hooks/bitbucket/:project_id', webhooksController.bitbucketWebhookHandler);

if (utils.settings.debug) {
  api.use('/status', status);
}

api.use(middleware.jwtValidation);
api.use(middleware.authorize);

api.use('/v1', v1);
api.use('/v2', v2);

api.use(middleware.errorHandler);
