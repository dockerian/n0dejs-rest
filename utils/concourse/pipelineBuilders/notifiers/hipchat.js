var utils = require('../../../index.js');

function HipChatNotifier() {}

HipChatNotifier.prototype.getSourceProperties = function (target) {
  var hipChatServerUrl = 'https://api.hipchat.com';
  if (utils.settings && utils.settings.hipChat) {
    hipChatServerUrl = utils.settings.hipChat.url;
  }

  return {
    hipchat_server_url: target.location,
    token: target.token
  };
};

HipChatNotifier.prototype.getStatus = function (buildStatus, project, build, commit, statusUri) {
  var description = '',
    color = 'yellow',
    buildReason,
    addCommitBody = true,
    commitBody = {};

  if (buildStatus.toLowerCase().indexOf("completed") > -1 || buildStatus.toLowerCase().indexOf("succeeded") > -1) {
    color = utils.constants.HipChatColor.Green;
  } else if (buildStatus.toLowerCase().indexOf("failed") > -1) {
    color = utils.constants.HipChatColor.Red;
  }

  if (commit) {
    description = `${buildStatus}, Project: ${project.name}. Commit: <a href='${commit.commitUrl}'>${commit.title}</a>. Trigger: ${build.reason_type}`;
  }
  return {
    'message': description,
    'from': utils.constants.System.Name,
    'color': color
  };
};

module.exports = HipChatNotifier;
