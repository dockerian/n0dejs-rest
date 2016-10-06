var utils = require('../../../index.js'),
  THREAD_ID_TEMPLATE = 'foobar-build_%s-commit_%s';

function FlowDockNotifier() {}

FlowDockNotifier.prototype.getSourceProperties = function (target) {
  return {
    flowdock_api_server_url: target.location,
    flow_token: target.token
  };
};

FlowDockNotifier.prototype.getStatus = function (buildStatus, project, build, commit, statusUri) {
  var description = '',
    color = 'yellow';

  if (buildStatus.toLowerCase().indexOf("succeeded") > -1 || buildStatus.toLowerCase().indexOf("completed") > -1) {
    color = utils.constants.HipChatColor.Green;
  } else if (buildStatus.toLowerCase().indexOf("failed") > -1) {
    color = utils.constants.HipChatColor.Red;
  }

  if (commit) {
    description = `${buildStatus}, Project: ${project.name}. Commit: <a href='${commit.commitUrl}'>${commit.title}</a>. Trigger: ${build.reason_type}`;
  }

  return {
    'title': commit.title,
    'body': description,
    'author_name': commit.author,
    'thread_id': `foobar_build_notification_${build.id}_${commit.commitSha}`,
    'thread_title': commit.title,
    'thread_body': description,
    'thread_external_url': statusUri,
    'thread_status_color': color
  };
};

module.exports = FlowDockNotifier;
