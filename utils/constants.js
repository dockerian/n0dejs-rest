module.exports = {
  System: {
    UserProvidedServiceName: 'n0dejs-api-%s',
    Name: 'N0deJS API'
  },
  Concourse: {
    JobName: 'start-job-in-pipeline'
  },
  VCS: {
    GitHub: 'github',
    BitBucket: 'BitBUckEt'
  },
  Github: {
    ApiVersion: '3.0.0',
    Protocol: 'https',
    Port: '443',
    TokenType: 'oauth'
  },
  LogTypes: {
    Build: 'build-log',
    Test: 'test-log',
    Deployment: 'deploy-log',
    PostDeployAction: 'post-deploy-action-log'
  },
  Steps: {
    Building: 'Building',
    Testing: 'Testing',
    Deploying: 'Deploying',
    PostDeployAction: 'Running Actions'
  },
  StepStatus: {
    Success: 'succeeded',
    Failure: 'failed'
  },
  Notifications: {
    PublicBuildStatusUri: '%s/builds/%s/'
  },
  PullRequestStatusDescription: {
    StartingBuild: 'Starting Build',
    BuildStarted: 'Building project',
    BuildFailed: 'Failed building project',
    BuildCompleted: 'Build finished',
    TestStarted: 'Running tests',
    TestCompleted: 'Finished running tests',
    TestFailed: 'Failed running tests',
    ReadyToMerge: 'Ready to merge',
    DeployStarted: 'Deploying project',
    DeployCompleted: 'Succesfully deployed, ready to merge',
    DeployFailed: 'Failed deploying project'
  },
  HipChatColor: {
    Yellow: 'yellow',
    Green: 'green',
    Red: 'red'
  },
  HipChat: {
    UrlFormat: '%s/v2/room/%s/notification?auth_token=%s',
    PublicApiUrl: 'https://api.hipchat.com'
  },
  Flowdock: {
    PublicApiUrl: 'https://api.flowdock.com'
  },
  PullRequestStatus: {
    Pending: 'pending',
    Error: 'error',
    Success: 'success'
  },
  BitBucketPullRequestStatus: {
    Pending: 'INPROGRESS',
    Error: 'FAILED',
    Success: 'SUCCESSFUL'
  },
  Status: {
    Building: 'Building',
    BuildFailed: 'Build Failed',
    BuildSucceeded: 'Build Succeeded',
    Testing: 'Testing',
    Rejected: 'Rejected',
    TestFailed: 'Test Failed',
    TestSucceeded: 'Test Succeeded',
    Deploying: 'Deploying',
    DeploySucceeded: 'Deployment Succeeded',
    DeployFailed: 'Deploy Failed',
    PostDeployAction: 'Running Actions',
    PostDeployActionFailed: 'Running Actions Failed',
    Success: 'Success',
    Unknown: 'Unknown',
    DeployFailed: 'Deploy Failed',
    PipelineCompleted: 'Pipeline Completed'
  },
  BuildReason: {
    Manual: "manual",
    Push: 'push',
    PullRequest: 'pull_request'
  },
  CloudFoundry: {
    ApplicationUrlFormat: 'http://%s.%s'
  },
  StormRunner: {
    ServiceUrl: 'https://stormrunner-load.saas.hp.com/v1',
    PollingInterval: 10000
  }
};
