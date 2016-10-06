var url = require('url'),
  utils = require('../../utils');

exports.getWebhookUrl = function getWebhookUrl(pathSegment, project) {
  // url.resolve will remove the `/v2` section if doesn't end with a trailing slash.
  // Check for trailing slash and add one.
  var webhookBaseUrl = utils.settings.crest.publicUri;
  if (webhookBaseUrl.indexOf("/v2/") === -1) {
    webhookBaseUrl += "/";
  }

  return url.resolve(webhookBaseUrl, `hooks/${pathSegment}/${project.id}`);
}
