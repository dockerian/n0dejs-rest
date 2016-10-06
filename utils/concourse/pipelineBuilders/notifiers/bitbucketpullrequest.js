var utils = require('../../../../utils');

function BitBucketPullRequestStatusNotifier() {}

BitBucketPullRequestStatusNotifier.prototype.getSourceProperties = function (target, project, build, commit) {
  var bitbucketServerUrl = project.vcs.api_url,
    hasTrustedCertificate;

  return {
    bitbucket_api_host: bitbucketServerUrl,
    verify_cert: false,
    bitbucket_user: project.repo_owner,
    bitbucket_repo: project.repo_name,
    bitbucket_token: target.token,
    bitbucket_sha: commit.commitSha,
    bitbucket_context: utils.constants.System.Name,
    verify_cert: !project.vcs.skip_ssl_validation
  };
};

BitBucketPullRequestStatusNotifier.prototype.getStatus = function (buildStatus, project, build, commit, statusUri) {
  var state = utils.constants.BitBucketPullRequestStatus.Pending,
    description = buildStatus,
    statusKey = `n0dejs-api-STATUS-${commit.commitSha}`;

  // The max length of a build status key in BitBucket is  40 characters
  // Hurray for undocumented field lengths:
  // https://confluence.atlassian.com/bitbucket/buildstatus-resource-779295267.html
  statusKey = statusKey.substring(0, 39);
  if (buildStatus.toLowerCase().indexOf('failed') > -1) {
    state = utils.constants.BitBucketPullRequestStatus.Error;
  } else if (buildStatus.toLowerCase() === utils.constants.Status.PipelineCompleted.toLowerCase()) {
    state = utils.constants.BitBucketPullRequestStatus.Success;
    description = utils.constants.PullRequestStatusDescription.ReadyToMerge;
  }

  return {
    bitbucket_name: `${utils.constants.System.Name}: ${description}`,
    bitbucket_key: statusKey,
    bitbucket_target_url: statusUri,
    bitbucket_state: state,
    bitbucket_sha: commit.commitSha,
    bitbucket_description: description
  }
};

module.exports = BitBucketPullRequestStatusNotifier;
