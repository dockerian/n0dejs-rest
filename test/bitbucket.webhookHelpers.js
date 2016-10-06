var should = require('should'),
  CommitPayload = require('./fixtures/bitbucket_commit_payload.json'),
  PushWebHookPayload = require('./fixtures/bitbucket_push_webhook_payload.json'),
  PullRequestCreatedWebHookPayload = require('./fixtures/bitbucket_pull_request_created_webhook_payload.json'),
  PullRequestUpdatedWebHookPayload = require('./fixtures/bitbucket_pull_request_updated_webhook_payload.json'),
  PullRequestRejectedWebHookPayload = require('./fixtures/bitbucket_pull_request_rejected_webhook_payload.json'),
  rewire = require('rewire'),
  bitbucketWebhookHelpers = rewire('../utils/vcs/bitbucket/webhookHelpers.js');

describe('utils/bitbucket/webhookHelpers', () => {
  var mockedClient = {};

  describe('extractCommit', () => {
    it('should extract commits for "commit" event', () => {
      var commit = bitbucketWebhookHelpers.extractCommit("commit", CommitPayload);
      commit.commitSha.should.be.equal('61d9e64348f9da407e62f64726337fd3bb24b466');
      commit.author.should.be.equal('jwalton');
      commit.timestamp.should.be.equal('2013-10-21T07:21:51+00:00');
      commit.title.should.be.equal(CommitPayload.message);
      commit.message.should.be.equal(CommitPayload.message);
      commit.compareUrl.should.be.equal(CommitPayload.links.diff.href);
      commit.avatarUrl.should.be.equal(CommitPayload.author.user.links.avatar.href);
      commit.commitUrl.should.be.equal(CommitPayload.links.html.href);
    });

    it('should extract commits for "commit" event, with external author', () => {
      CommitPayload.author = {
        raw: "foo bar <bbuser@gmail.com>"
      };

      var commit = bitbucketWebhookHelpers.extractCommit("commit", CommitPayload);
      commit.commitSha.should.be.equal('61d9e64348f9da407e62f64726337fd3bb24b466');
      commit.author.should.be.equal('foo bar <bbuser@gmail.com>');
      commit.avatarUrl.should.be.equal('https://api.n0dejs.com');
      commit.timestamp.should.be.equal('2013-10-21T07:21:51+00:00');
      commit.title.should.be.equal(CommitPayload.message);
      commit.message.should.be.equal(CommitPayload.message);
      commit.compareUrl.should.be.equal(CommitPayload.links.diff.href);
      commit.avatarUrl.should.be.equal(CommitPayload.author.user.links.avatar.href);
      commit.commitUrl.should.be.equal(CommitPayload.links.html.href);
    });

    it('should extract commits for "repo:push" event', () => {
      var commit = bitbucketWebhookHelpers.extractCommit("repo:push", PushWebHookPayload),
        latestCommit = PushWebHookPayload.push.changes[0].new;;
      commit.commitSha.should.be.equal('6aacb1c5c8a575d7c8f81d1b8e17523e68a86a76');
      commit.author.should.be.equal('bbfoobar');
      commit.timestamp.should.be.equal('2016-05-24T19:44:34+00:00');
      commit.base_branch.should.be.equal('master');
      commit.title.should.be.equal(latestCommit.target.message);
      commit.message.should.be.equal(latestCommit.target.message);
      commit.compareUrl.should.be.equal(latestCommit.links.html.href);
      commit.avatarUrl.should.be.equal(latestCommit.target.author.user.links.avatar.href);
      commit.commitUrl.should.be.equal(latestCommit.links.html.href);
    });

    it('should extract commits for "repo:push" event, with external author', () => {
      PushWebHookPayload.push.changes[0].new.target.author = {
        raw: "foo bar <bbuser@gmail.com>"
      };

      var commit = bitbucketWebhookHelpers.extractCommit("repo:push", PushWebHookPayload),
        latestCommit = PushWebHookPayload.push.changes[0].new;;
      commit.commitSha.should.be.equal('6aacb1c5c8a575d7c8f81d1b8e17523e68a86a76');
      commit.author.should.be.equal('foo bar <bbuser@gmail.com>');
      commit.avatarUrl.should.be.equal('https://api.n0dejs.com');
      commit.timestamp.should.be.equal('2016-05-24T19:44:34+00:00');
      commit.base_branch.should.be.equal('master');
      commit.title.should.be.equal(latestCommit.target.message);
      commit.message.should.be.equal(latestCommit.target.message);
      commit.compareUrl.should.be.equal(latestCommit.links.html.href);
      commit.avatarUrl.should.be.equal(latestCommit.target.author.user.links.avatar.href);
      commit.commitUrl.should.be.equal(latestCommit.links.html.href);
    });

    it('should extract commits for "pullrequest:created" event', () => {
      var pullRequest = bitbucketWebhookHelpers.extractCommit("pullrequest:created", PullRequestCreatedWebHookPayload, 'my_secret_token');

      pullRequest.number.should.be.equal(4);
      pullRequest.commitSha.should.be.equal('5c9c2d817984');
      pullRequest.timestamp.should.be.equal('2016-05-25T15:52:30.666302+00:00');

      pullRequest.author.should.be.equal('bbuser');
      pullRequest.avatarUrl.should.be.equal('https://bitbucket.org/account/bbuser/avatar/32/');

      pullRequest.repo_branch.should.be.equal('myChanges');
      pullRequest.base_branch.should.be.equal('master');
      pullRequest.base.repo.full_name.should.be.equal('bbfoobar/gitstats');
      pullRequest.base.repo_branch.should.be.equal('master');
      pullRequest.base.clone_url.should.be.equal('https://x-token-auth:my_secret_token@bitbucket.org/bbuser/gitstats');

      pullRequest.title.should.be.equal('Change application name');
      pullRequest.message.should.be.equal('Change application name');
      pullRequest.compareUrl.should.be.equal('https://bitbucket.org/bbuser/gitstats/pull-requests/4');
      pullRequest.commitUrl.should.be.equal('https://bitbucket.org/bbuser/gitstats/pull-requests/4');
      pullRequest.clone_url.should.be.equal('https://x-token-auth:my_secret_token@bitbucket.org/bbuser/my-gitstats');
    });

    it('should extract commits for "pullrequest:updated" event', () => {
      var pullRequest = bitbucketWebhookHelpers.extractCommit("pullrequest:updated", PullRequestUpdatedWebHookPayload, 'my_secret_token');

      pullRequest.number.should.be.equal(4);
      pullRequest.commitSha.should.be.equal('768d17c82ac4');
      pullRequest.timestamp.should.be.equal('2016-05-25T15:52:30.666302+00:00');

      pullRequest.author.should.be.equal('bbuser');
      pullRequest.avatarUrl.should.be.equal('https://bitbucket.org/account/bbuser/avatar/32/');

      pullRequest.repo_branch.should.be.equal('myChanges');
      pullRequest.base_branch.should.be.equal('master');
      pullRequest.base.repo.full_name.should.be.equal('bbfoobar/gitstats');
      pullRequest.base.repo_branch.should.be.equal('master');
      pullRequest.base.clone_url.should.be.equal('https://x-token-auth:my_secret_token@bitbucket.org/bbuser/gitstats');

      pullRequest.title.should.be.equal('Change application name');
      pullRequest.message.should.be.equal('Change application name');
      pullRequest.compareUrl.should.be.equal('https://bitbucket.org/bbuser/gitstats/pull-requests/4');
      pullRequest.commitUrl.should.be.equal('https://bitbucket.org/bbuser/gitstats/pull-requests/4');
      pullRequest.clone_url.should.be.equal('https://x-token-auth:my_secret_token@bitbucket.org/bbuser/my-gitstats');
    });

    it('should extract commits for "pullrequest:rejected" event', () => {
      var pullRequest = bitbucketWebhookHelpers.extractCommit("pullrequest:rejected", PullRequestRejectedWebHookPayload, 'my_secret_token');

      pullRequest.number.should.be.equal(3);
      pullRequest.commitSha.should.be.equal('9405c8de9d95');
      pullRequest.timestamp.should.be.equal('2016-05-25T15:43:43.397072+00:00');

      pullRequest.author.should.be.equal('bbuser');
      pullRequest.avatarUrl.should.be.equal('https://bitbucket.org/account/bbuser/avatar/32/');

      pullRequest.repo_branch.should.be.equal('bbuser/packagejsonchange');
      pullRequest.base_branch.should.be.equal('master');
      pullRequest.base.repo.full_name.should.be.equal('bbfoobar/gitstats');
      pullRequest.base.repo_branch.should.be.equal('master');
      pullRequest.base.clone_url.should.be.equal('https://x-token-auth:my_secret_token@bitbucket.org/bbuser/gitstats');

      pullRequest.title.should.be.equal('package.json edited online with Bitbucket');
      pullRequest.message.should.be.equal('package.json edited online with Bitbucket');
      pullRequest.compareUrl.should.be.equal('https://bitbucket.org/bbuser/gitstats/pull-requests/3');
      pullRequest.commitUrl.should.be.equal('https://bitbucket.org/bbuser/gitstats/pull-requests/3');
      pullRequest.clone_url.should.be.equal('https://x-token-auth:my_secret_token@bitbucket.org/bbuser/gitstats');
    });

    it("Should throw on unsupported event types", () => {
      bitbucketWebhookHelpers.extractCommit.should.throw(/Not Supported/);
    });
  });

  describe('isValidHmac', () => {
    it('should calculate isValidHmac', () => {
      bitbucketWebhookHelpers.isValidHmac.should.throw(/Not Implemented/);
    });
  });

  describe('isValidPayload', () => {
    it('should calculate isValidPayload for repo:push', () => {
      bitbucketWebhookHelpers.isValidPayload('repo:push', PushWebHookPayload).should.not.be.equal(false);
    });

    it('should calculate isValidPayload for pullrequest:created', () => {
      bitbucketWebhookHelpers.isValidPayload('pullrequest:created', PullRequestCreatedWebHookPayload).should.not.be.equal(false);
    })

    it('should calculate isValidPayload for pullrequest:updated', () => {
      bitbucketWebhookHelpers.isValidPayload('pullrequest:updated', PullRequestUpdatedWebHookPayload).should.not.be.equal(false);
    });

    it('should spot invalid payloads for repo:push', () => {
      bitbucketWebhookHelpers.isValidPayload('repo:push', CommitPayload).should.be.equal(false);
    });

    it('should spot invalid payloads for pullrequest:created', () => {
      bitbucketWebhookHelpers.isValidPayload('pullrequest:created', CommitPayload).should.be.equal(false);
    });

    it('should spot invalid payloads for pullrequest:updated', () => {
      bitbucketWebhookHelpers.isValidPayload('pullrequest:updated', CommitPayload).should.be.equal(false);
    });
  });

  describe('isValidBranch', () => {
    it('should calculate isValidBranch for repo:push', () => {
      bitbucketWebhookHelpers.isValidBranch('repo:push', PushWebHookPayload, {
        repo_branch: 'master'
      }).should.be.true();
    });
  });

  describe('isSupportedEvent', () => {
    [
      {
        eventName: 'repo:push',
        supported: true,
        suffix: "supported"
      },
      {
        eventName: 'pullrequest:created',
        supported: true,
        suffix: "supported"
      },
      {
        eventName: 'pullrequest:updated',
        supported: true,
        suffix: "supported"
      },
      {
        eventName: 'pullrequest:fulfilled',
        supported: true,
        suffix: "supported"
      },
      {
        eventName: 'pullrequest:rejected',
        supported: true,
        suffix: "supported"
      }
    ].forEach((item) => {
      it(`${item.eventName} is ${item.suffix}`, () => {
        bitbucketWebhookHelpers.isSupportedEvent(item.eventName).should.be.equal(item.supported);
      });
    });
  });

  describe('getFriendlyEventType', () => {
    it('should get friendly event type', () => {
      bitbucketWebhookHelpers.getFriendlyEventType('repo:push').should.be.equal('push');
    });
  });

  describe('isPullRequest', () => {
    it('pr_opened is a PullRequest event', () => {
      bitbucketWebhookHelpers.isPullRequest('pr_opened').should.be.true();
    });
    it('pr_synchronize is a PullRequest event', () => {
      bitbucketWebhookHelpers.isPullRequest('pr_synchronize').should.be.true();
    });
  });

  describe('getWebhookUrl', () => {
    it('should get webhookUrl without trailing slash', () => {
      bitbucketWebhookHelpers.__set__('utils.settings.crest.publicUri', 'https://api.n0dejs.com/v2')
      bitbucketWebhookHelpers.getWebhookUrl({
          id: 15
        })
        .should.be.equal('https://api.n0dejs.com/v2/hooks/bitbucket/15');
    });

    it('should get webhookUrl with trailing slash', () => {
      bitbucketWebhookHelpers.__set__('utils.settings.crest.publicUri', 'https://api.n0dejs.com/v2/')
      bitbucketWebhookHelpers.getWebhookUrl({
          id: 15
        })
        .should.be.equal('https://api.n0dejs.com/v2/hooks/bitbucket/15');
    });
  });

  describe('getCloneUrl', () => {
    it('should get clone Url', () => {
      var cloneUrl = bitbucketWebhookHelpers.getCloneUrl('https://bitbucket.org/user/repo.git', 'mytoken');
      cloneUrl.should.be.equal('https://x-token-auth:mytoken@bitbucket.org/user/repo.git');
    });
  });

});
