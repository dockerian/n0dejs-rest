var credential = {
    "username": 'dockerhub_user',
    "password": 'dockerhub_password',
    "email": 'dockerhub_email@email.com'
  },
  image_registry = {
    image_registry_id: 2,
    registry_url: "https://registry-1.docker.io/foobar",
    registry_label: "DockerHub 2.0"
  };

module.exports = {
  workers: {
    gitMerge: {
      tag: "kosher-prod",
      repository: 'git-merge-worker',
      credential: credential,
      image_registry: image_registry
    },
    stormRunner: {
      tag: "kosher-prod",
      repository: 'stormrunner-worker',
      credential: credential,
      image_registry: image_registry
    },
    cloudFoundry: {
      tag: "kosher-prod",
      repository: 'n0dejs-cloud-foundry-worker',
      credential: credential,
      image_registry: image_registry
    }
  },
  notifiers: {
    buildEvent: {
      tag: "kosher-prod",
      repository: 'n0dejs-build-event-notification-resource',
      credential: credential,
      image_registry: image_registry
    },
    hipchat: {
      tag: "kosher-prod",
      repository: 'hipchat-notification-resource',
      credential: credential,
      image_registry: image_registry
    },
    http: {
      tag: "kosher-prod",
      repository: 'http-notification-resource',
      credential: credential,
      image_registry: image_registry
    },
    githubpullrequest: {
      tag: "kosher-prod",
      repository: 'github-pr-notification-resource',
      credential: credential,
      image_registry: image_registry
    },
    bitbucketpullrequest: {
      tag: "kosher-prod",
      repository: 'bitbucket-pr-notification-resource',
      credential: credential,
      image_registry: image_registry
    },
    flowdock: {
      tag: "kosher-prod",
      repository: 'flowdock-notification-activity-resource',
      credential: credential,
      image_registry: image_registry
    },
    slack: {
      tag: "kosher-prod",
      repository: 'slack-notification-resource',
      credential: credential,
      image_registry: image_registry
    }
  }
};
