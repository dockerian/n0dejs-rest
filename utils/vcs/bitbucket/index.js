var clientType = require('./client.js');
module.exports = function (vcsInstance) {
  return {
    client: new clientType(vcsInstance),
    webhookHelpers: require('./webhookHelpers.js'),
    supportsManualTrigger: true,
    supportsWebhooks: true,
    pr_statusNotificationType: "bitbucketpullrequest"
  };
}
