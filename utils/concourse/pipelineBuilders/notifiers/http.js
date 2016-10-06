function HttpNotifier() {}

HttpNotifier.prototype.getSourceProperties = function (target) {
  return {
    uri: target.location
  };
};

HttpNotifier.prototype.getStatus = function (buildStatus, project, build, commit, statusUri) {
  var payload = {};
  payload.status = buildStatus;
  payload.commit = commit;
  payload.build = {
    id: build.id
  };
  payload.statusUri = statusUri;

  return {
    body: JSON.stringify(payload)
  };
};

module.exports = HttpNotifier;
