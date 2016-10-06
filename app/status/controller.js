var async = require('async'),
  utils = require('../../utils');

exports.getStatus = function getStatus(req, res, next) {

  var systemStatus = {};
  return async.parallel([
   getDataBaseSchemaVersion,
   getConcourseStatus
 ], collectAndSendResult);

  function getDataBaseSchemaVersion(callback) {
    return req.db.driver.execQuery('select MAX(version) as version from dbversion;', (err, results) => {
      if (err || !results || !results[0] || !results[0].version) {
        systemStatus.db_schema_version = "Can not retrieve data base schema version";
      } else {
        systemStatus.db_schema_version = results[0].version;
      }
      callback();
    });
  };

  function getConcourseStatus(callback) {
    utils.concourse.client().loginAndSync((err) => {
      systemStatus.concourse_accessible = !err;
      callback();
    });
  };

  function collectAndSendResult() {

    systemStatus.api_version = 2.0;
    systemStatus.concourse_location = process.env.CONCOURSE_ENDPOINT || "Unknown";
    systemStatus.db_host = process.env.DB_HOST || "Unknown";
    systemStatus.db_user = process.env.DB_USER || "Unknown";
    systemStatus.db_name = process.env.DB_NAME || "Unknown";

    return res.send(systemStatus);
  };
};
