var should = require('should'),
  sinon = require('sinon'),
  _ = require('lodash'),
  utils = require('../utils'),
  fs = require('fs'),
  vcsProviders;

describe('contracts/utils/vcs', () => {
  var githubVCS = {
      vcs_type: {
        vcs_type: utils.constants.VCS.GitHub
      }
    },
    bitbucketVCS = {
      vcs_type: {
        vcs_type: utils.constants.VCS.BitBucket
      }
    };
  before((done) => {
    vcsProviders = [];
    fs.readdir(__dirname + '/../utils/vcs/', (err, files) => {
      if (err) {
        return done(err);
      }

      _.each(files, (file) => {
        if (file.indexOf('.js') === -1) {
          vcsProviders.push(file);
        }
      });
      done();
    });
  });

  describe("supported providers", () => {

    it("GitHub VCS is supported", () => {
      should.exist(utils.vcs(githubVCS),
        "Github VCS Provider should be supported");
    });

    it("BitBucket VCS is supported", () => {
      should.exist(utils.vcs(bitbucketVCS),
        "BitBucket VCS Provider should be supported");
    });
  });

  describe("webhookHelpers tests", () => {
    it("webhookHelpers property is exported", (done) => {
      assertPropertyExported('webhookHelpers', done);
    });

    it("webhookHelpers exports extractCommit", (done) => {
      assertMethodExported('webhookHelpers', 'extractCommit', done);
    });

    it("webhookHelpers exports isValidPayload", (done) => {
      assertMethodExported('webhookHelpers', 'isValidPayload', done);
    });

    it("webhookHelpers exports isValidHmac", (done) => {
      assertMethodExported('webhookHelpers', 'isValidHmac', done);
    });

    it("webhookHelpers exports isValidBranch", (done) => {
      assertMethodExported('webhookHelpers', 'isValidBranch', done);
    });

    it("webhookHelpers exports isSupportedEvent", (done) => {
      assertMethodExported('webhookHelpers', 'isSupportedEvent', done);
    });

    it("webhookHelpers exports isPullRequest", (done) => {
      assertMethodExported('webhookHelpers', 'isPullRequest', done);
    });

    it("webhookHelpers exports getFriendlyEventType", (done) => {
      assertMethodExported('webhookHelpers', 'getFriendlyEventType', done);
    });

    it("webhookHelpers exports getCloneUrl", (done) => {
      assertMethodExported('webhookHelpers', 'getCloneUrl', done);
    });

    it("webhookHelpers exports friendlyEventTypes", (done) => {
      assertMethodExported('webhookHelpers', 'friendlyEventTypes', done);
    });

    it("webhookHelpers exports getWebhookUrl", (done) => {
      assertMethodExported('webhookHelpers', 'getWebhookUrl', done);
    });
  });

  describe("client tests", () => {
    it("client property is exported", (done) => {
      assertPropertyExported('client', done);
    });

    it("client exports getFileContents", (done) => {
      assertMethodExported('client', 'getFileContents', done);
    });

    it("client exports getCommit", (done) => {
      assertMethodExported('client', 'getCommit', done);
    });

    it("client exports updatePRStatus", (done) => {
      assertMethodExported('client', 'updatePRStatus', done);
    });

    it("client exports deleteWebhook", (done) => {
      assertMethodExported('client', 'deleteWebhook', done);
    });

    it("client exports refreshProjectToken", (done) => {
      assertMethodExported('client', 'refreshProjectToken', done);
    });

    it("client exports addWebhook", (done) => {
      assertMethodExported('client', 'addWebhook', done);
    });
  });
});

function runOnEveryProvider(testFunc, done) {
  var counter = 0;
  _.each(vcsProviders, function (provider) {
    counter++;
    testFunc(provider, () => {
      if (counter === (vcsProviders.length) && done) {
        done();
      }
    });
  });
}

function assertMethodExported(exportedProperty, method, done) {
  runOnEveryProvider((provider, cb) => {
    should.exist(utils.vcs({
        vcs_type: {
          vcs_type: provider
        }
      })[exportedProperty][method],
      `${provider}.${exportedProperty} should support ${method}`);
    cb();
  }, done);
}

function assertPropertyExported(exportedProperty, done) {
  runOnEveryProvider((provider, cb) => {
    should.exist(utils.vcs({
        vcs_type: {
          vcs_type: provider
        }
      })[exportedProperty],
      `${provider} should export a ${exportedProperty} property`);
    cb();
  }, done);
}
