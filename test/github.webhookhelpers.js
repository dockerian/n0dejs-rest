var should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  utils = require('../utils'),
  payload = require('./fixtures/github_push_unicode_webhook.json'),
  webhookHelpers = rewire('../utils/vcs/github/webhookHelpers.js');

describe('utils/github/webhookHelpers', () => {
  var mockLogger = {
    debug: sinon.stub()
  };

  describe("isValidHmac", () => {
    it("Can validate signatures with Unicode Characters", () => {
      webhookHelpers.isValidHmac('mysecret', payload, "sha1=f0d1a3cc2d0f81e55d319d96868d97835853d7e4", mockLogger)
        .should.be.true();
    });
  });
});
