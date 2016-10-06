var utils = require('../../../index.js'),
  THREAD_ID_TEMPLATE = 'foobar-build_%s-commit_%s';

function SlackNotifier() {}

SlackNotifier.prototype.getSourceProperties = function (target) {
  return {
    url: target.location,
    username: utils.constants.System.Name,
    channel: target.token
  };
};

SlackNotifier.prototype.getStatus = function (buildStatus, project, build, commit, statusUri) {
  var color = '#ffcc00';

  if (buildStatus.toLowerCase().indexOf("succeeded") > -1) {
    color = 'good';
  } else if (buildStatus.toLowerCase().indexOf("failed") > -1) {
    color = 'danger';
  }

  return {
    message: " ",
    attachments: [
      {
        fallback: "N0deJS API Status",
        color: color,
        title: buildStatus,
        title_link: statusUri,
        fields: [
          {
            title: "Commit",
            value: `<${commit.compareUrl}|${commit.title}>`,
            short: true
          },
          {
            title: "Branch",
            value: commit.repo_branch,
            short: true
          },
          {
            title: "Committer",
            value: commit.author,
            short: true
          },
          {
            title: "Project",
            value: project.name,
            short: true
          }
        ]
      }
    ]
  };
};

module.exports = SlackNotifier;
