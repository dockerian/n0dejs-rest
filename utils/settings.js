var fs = require('fs'),
  url = require('url'),
  utils = require('./index.js');

var publicUri, privateUri, authenticationEdpoint;

publicUri = getPublicUri();
privateUri = getPrivateUri();
authenticationEndpoint = getUAAEndpoint();
isDebugEnabled = parseDebug();
module.exports = {
  storage: {
    type: 'local',
    containerPath: process.env.ARTIFACT_STORAGE_VOLUME || '/artifacts'
  },
  database: {
    instance: {
      autoFetch: true
    },
    protocol: 'mysql',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || '3306',
    user: process.env.DB_USER || 'apiuser',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'n0dejs-db',
    encryptionKeyFile: './tools/dbencryptionkey'
  },
  concourse: {
    apiUrl: process.env.CONCOURSE_ENDPOINT,
    host: process.env.CONCOURSE_TSA_HOST,
    port: process.env.CONCOURSE_TSA_PORT || '8080',
    username: process.env.CONCOURSE_USERNAME,
    password: process.env.CONCOURSE_PASSWORD,
    registryMirrorUrl: process.env.REGISTRY_MIRROR,
    registryMirrorHostPort: process.env.REGISTRY_MIRROR ? getHostPort(process.env.REGISTRY_MIRROR) : ""
  },
  crest: {
    apiVersion: 'v2',
    httpsPort: process.env.API_REST_SERVICE_PORT_HTTPS || 4443,
    httpPort: process.env.API_REST_SERVICE_PORT_HTTP || 8880,
    publicUri: publicUri,
    privateUri: privateUri,
    sslCertificate: null,
    sslKey: null
  },
  docker_username: process.env.DOCKER_USERNAME,
  docker_image_tag: process.env.DOCKER_IMAGE_TAG || 'kosher-prod',
  taskCommands: {
    clone: "/scripts/gitclone >> /tmp/clone_log.txt 2>&1 ;" +
      "echo $? > $output_directory/exitcode;" +
      "cp /tmp/clone_log.txt $output_directory/clone_log.txt",
    gitMerge: "/scripts/gitmerge >> /tmp/merge_log.txt 2>&1 ;" +
      "echo $? > $output_directory/exitcode;" +
      "cp /tmp/merge_log.txt $output_directory/merge_log.txt",
    build: "/src/bin/build.sh ${PWD}/n0dejs-git-repo ${PWD}/build_code_output >> /tmp/build_log.txt 2>&1 ;" +
      " echo $? > build_code_output/exitcode ;" +
      " cp /tmp/build_log.txt build_code_output/build_log.txt;" +
      " cat build_code_output/build_log.txt",
    test: "/src/bin/test.sh ${PWD}/build_code_output ${PWD}/test_code_output >>/tmp/test_log.txt 2>&1 ;" +
      " echo $? > test_code_output/exitcode ;" +
      " cp /tmp/test_log.txt test_code_output/test_log.txt;" +
      " cat test_code_output/test_log.txt",
    deploy: "date -u +'%Y-%m-%dT%H:%M:%SZ'>deploy_output/starttime;" +
      "(local rc=0; /scripts/cfdeploy >>deploy_output/deploy_log.txt 2>&1; rc=$?;" +
      "/scripts/get_application_url $cf_application_path/$manifest $rc >>deploy_output/applicationurl; exit $rc);" +
      "echo $? > deploy_output/exitcode;" +
      "/scripts/get_additional_logs $cf_application_path/$manifest $(echo deploy_output/exitcode)>>deploy_output/deploy_log.txt 2>&1;" +
      "cat deploy_output/deploy_log.txt;" +
      "date -u +'%Y-%m-%dT%H:%M:%SZ'>deploy_output/endtime;",
    stormRunnerLoadTest: "date -u +\'%Y-%m-%dT%H:%M:%SZ\'>storm-runner-logs/starttime ;" +
      "  /scripts/notify >>storm-runner-logs/storm_runner_log.txt 2>&1 ;" +
      " echo $? >storm-runner-logs/exitcode ;" +
      " cat storm-runner-logs/storm_runner_log.txt ;" +
      " date -u +\'%Y-%m-%dT%H:%M:%SZ\'>storm-runner-logs/endtime",
    delete_app: '/scripts/cfdelete'
  },
  auth: {
    endpoint: authenticationEndpoint
  },
  serviceAccount: {
    clientID: 'n0dejs-api-service',
    clientSecret: 'client_secret'
  },
  watchdog: {
    interval: process.env.WATCHDOG_INTERVAL ? Number(process.env.WATCHDOG_INTERVAL) * 1000 : 60 * 1000
  },
  debug: isDebugEnabled
};

function parseDebug() {
  return (process.env.DEBUG && process.env.DEBUG.toLowerCase() === 'true');
}

module.exports.loadCerts = function loadCerts() {
  // we don't want to call this function immediately when settings is required like the others,
  // as there's a chance it could fail and the error would be hard to diagnose.
  module.exports.crest.sslKey = process.env.SSL_CERT_KEY;
  module.exports.crest.sslCertificate = process.env.SSL_CERT_CRT;
  module.exports.serviceAccount.clientSecret = process.env.SERVICE_ACCOUNT_SECRET;
}

function getPrivateUri() {
  var ceAPIHost, privateUri;
  if (process.env.API_HOST) {
    privateUri = "http://" + process.env.API_HOST + "/v2";
  } else {
    privateUri = "http://localhost:3001/v2"
  }

  return privateUri;
}

function getPublicUri() {
  var publicUri;

  if (process.env.LB_REST_HTTPS) {
    publicUri = `https://${process.env.LB_REST_HTTPS}/v2`;
  } else if (process.env.LB_REST_HTTP) {
    publicUri = `http://${process.env.LB_REST_HTTP}/v2`;
  } else if (process.env.PUBLIC_API_URL) {
    publicUri = process.env.PUBLIC_API_URL.replace(/\/$/, "");
  } else if (process.env.REST_PORT) {
    publicUri = changeSchemeInUri(process.env.REST_PORT, 'http') + "/v2";
  } else {
    publicUri = 'UNKNOWN';
  }

  return publicUri;
}

function getUAAEndpoint() {
  var host = process.env.HCP_IDENTITY_EXTERNAL_HOST || process.env.HCP_IDENTITY_HOST,
    port = process.env.HCP_IDENTITY_EXTERNAL_PORT || process.env.HCP_IDENTITY_PORT;

  if (host) {
    if (process.env.HCP_INSTANCE_ID) {
      host = `${process.env.HCP_INSTANCE_ID}.${host}`;
    }

    if (port) {
      host = `${host}:${port}`
    }

    return `${process.env.HCP_IDENTITY_SCHEME}:\/\/${host}`
  }

  return "";
}

function changeSchemeInUri(host, newScheme) {
  var parsed = url.parse(host);
  if (parsed) {
    if (parsed.port) {
      return `${newScheme}://${parsed.hostname}:${parsed.port}`;
    }
    if (parsed.hostname) {
      return `${newScheme}://${parsed.hostname}`;
    }
    return 'http://unknown';
  }
}

function getHostPort(fullUrl) {
  var parsed = url.parse(fullUrl);
  if (parsed.port) {
    return `${parsed.hostname}:${parsed.port}`;
  }
  return parsed.hostname;
}

module.exports.setSystemConfigurationValue = function setSystemConfigurationValue(key, value, callback) {
  utils.database.connection((err, connection) => {
    if (err) {
      return callback(err);
    }
    connection.models.system_configuration.find({
      'key': key
    }, (err, results) => {
      if (err) {
        return callback(err);
      }
      if (results.length === 0) {
        connection.models.system_configuration.create({
          'key': key,
          'value': value
        }, callback);
      } else {
        results[0].value = value;
        results[0].save(callback);
      }
    });
  });
}

module.exports.getSystemConfigurationValue = function getSystemConfigurationValue(key, callback) {
  utils.database.connection((err, connection) => {
    if (err) {
      return callback(err);
    }
    connection.models.system_configuration.find({
      'key': key
    }, (err, results) => {
      callback(err, results[0].value);
    });
  });
}
