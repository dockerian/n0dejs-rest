var utils = require('../../../../utils'),
  url = require('url');

function GitHubPullRequestStatusNotifier() {}

GitHubPullRequestStatusNotifier.prototype.getSourceProperties = function (target, project, build, commit) {
  var githubApiEndpoint = '',
    apiPath = url.parse(project.vcs.api_url),
    hasTrustedCertificate;

  if (apiPath.path === "/") {
    apiPath.path = "";
  }

  githubApiEndpoint = apiPath.path;
  hasTrustedCertificate = false;

  return {
    github_api_host: apiPath.host,
    github_api_endpoint: githubApiEndpoint,
    verify_cert: hasTrustedCertificate,
    github_user: project.repo_owner,
    github_repo: project.repo_name,
    github_token: target.token,
    github_context: utils.constants.System.Name,
    verify_cert: !project.vcs.skip_ssl_validation
  };
};

GitHubPullRequestStatusNotifier.prototype.getStatus = function (buildStatus, project, build, commit, statusUri) {
  var state = utils.constants.PullRequestStatus.Pending,
    description = buildStatus;

  if (buildStatus.toLowerCase().indexOf('failed') > -1) {
    state = utils.constants.PullRequestStatus.Error;
  } else if (buildStatus.toLowerCase() === utils.constants.Status.PipelineCompleted.toLowerCase()) {
    state = utils.constants.PullRequestStatus.Success;
    description = utils.constants.PullRequestStatusDescription.ReadyToMerge;
  }

  return {
    github_target_url: statusUri,
    github_state: state,
    github_sha: commit.commitSha,
    github_description: description
  }
};

module.exports = GitHubPullRequestStatusNotifier;
