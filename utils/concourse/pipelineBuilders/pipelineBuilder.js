var BuildRepoHeadPipeline = require('./build_repo_head'),
  BuildPullRequestClosedPipeline = require('./close_pull_request'),
  BuildPullRequestPipeline = require('./build_pull_request');

module.exports = function getPipelineBuilder(pipelineType) {
  switch (pipelineType.toLowerCase()) {
    case "build_repo_head":
    case "push":
    case "manual":
      return new BuildRepoHeadPipeline();
    case "pull_request":
    case "pr_opened":
    case "pr_synchronize":
      return new BuildPullRequestPipeline();
    case "close_pull_request":
      return new BuildPullRequestClosedPipeline();
    default:
      throw new Error("Pipeline type [" + pipelineType + "] not supported");
  }
};
