var async = require('async'),
  http = require('http'),
  https = require('https'),
  request = require('request'),
  url = require('url'),
  actuators = require('./utils/actuators'),
  utils = require('./utils'),
  httpsServer, httpServer;

utils.database
  .verify()
  .then(utils.concourse.client().loginAndSync)
  .then(checkCerts)
  .then(getUAAPublicCert)
  .then(startServer)
  .catch((err) => {
    utils.logger.error(err.message);
    utils.logger.error('Unable to start n0dejs api rest service.');
    process.exit(1);
  });

function setupProxies() {
  if (process.env.HTTP_PROXY) {
    process.env.http_proxy = process.env.HTTP_PROXY;
  }

  if (process.env.HTTPS_PROXY) {
    process.env.https_proxy = process.env.HTTPS_PROXY;
  }

  utils.logger.info(`Started server with Proxies:
    HTTP_PROXY : ${process.env.HTTP_PROXY}
    HTTPS_PROXY : ${process.env.HTTPS_PROXY}`);
}

function startServer() {
  setupProxies();

  // Set process listeners
  process.on('uncaughtException', handleUncaughtException);
  process.on('SIGTERM', doGracefullShutdown);
  process.on('SIGINT', doGracefullShutdown);

  return async.series([
    startHttps,
    startHttp
  ], () => {
    utils.logger.info('All services started, ready to accept requests.');
  });

  function startHttps(next) {
    var certOptions = {
      key: utils.settings.crest.sslKey,
      cert: utils.settings.crest.sslCertificate
    };

    httpsServer = https
      .createServer(certOptions, require('./app'))
      .listen(utils.settings.crest.httpsPort, () => {
        utils.logger.info(`N0deJS API REST Service started listening on HTTPS/${utils.settings.crest.httpsPort}.`);
        next();
      });

    httpsServer.on('error', handleUncaughtException);
  }

  function startHttp(next) {
    // Redirect http requests to https
    httpServer = http
      .createServer(require('./app'))
      .listen(utils.settings.crest.httpPort, () => {
        utils.logger.info(`Redirect service started listening on HTTP/${utils.settings.crest.httpPort}.`);
      });
  }
}

function redirect(req, res) {
  var httpsUrl = url.parse(utils.settings.crest.publicUri);
  var requestUrl = url.parse(req.url);

  // Copy only the path/query related aspects of the request URL to the new
  // redirect URL. The protocol/host/port parts of requestUrl will be null.
  Object.keys(requestUrl).forEach((property) => {
    httpsUrl[property] = requestUrl[property] || httpsUrl[property];
  });

  res.writeHead(302, {
    Location: url.format(httpsUrl)
  });
  res.end();
}

function checkCerts() {
  return new Promise((resolve, reject) => {
    try {
      utils.settings.loadCerts();

      if (utils.settings.crest.sslKey && utils.settings.crest.sslCertificate) {
        utils.logger.info('Found valid SSL Certificates.')
        resolve();
      } else {
        throw new Error('SSL Certificate files appear to be empty.');
      }
    } catch (err) {
      utils.logger.error('Unable to find valid SSL Certificates.')
      reject(err);
    }
  });
}

function getUAAPublicCert() {
  return new Promise((resolve, reject) => {
    request.get({
      url: `${utils.settings.auth.endpoint}/token_key`,
      json: true,
      rejectUnauthorized: false
    }, (err, res, body) => {
      if (err) {
        utils.logger.error(`Unable to get public key to validate auth tokens. ${err.message}`);
        return reject(err);
      }
      utils.logger.info('Received Auth public certificate from UAA provider.');
      utils.settings.auth.certificate = body.value;
      return resolve();
    });
  });
}

function handleUncaughtException(err) {
  utils.logger.error('An uncaught exception was thrown.', err);
  doGracefullShutdown(true);
}

function doGracefullShutdown(exitWithError) {
  utils.logger.info('API service shutting down, waiting for pending requests to complete.');

  // Shut down the server, 'close' will drain
  // then block on existing pending requests.
  httpsServer.close(() => {
    utils.logger.info('API service shutdown completed.');
    process.exit(exitWithError ? 1 : 0);
  });

  // Shut down the redirect server.
  // We don't care about the result.
  if (httpServer) {
    httpServer.close();
  }
}
