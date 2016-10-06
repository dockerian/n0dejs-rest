var should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  utils = require('../utils'),
  githubClient = rewire('../utils/vcs/github/client.js');

describe('utils/github/client', () => {
  var mockedClient = {},
    mockedClientConstructor,
    mockedWebhook,
    githubVCS,
    mockedProject;

  beforeEach(() => {
    githubVCS = {
      api_url: 'https://api.github.com/'
    };
    mockedWebhook = {
      id: 1
    };
    mockedProject = {
      repo_owner: 'owner',
      repo_name: 'repo name',
      repo_webhookUrl: 'http://www.google.com/',
      repo_secret: 'secret',
      token: 'token'
    };
    mockedClientConstructor = sinon.stub().returns(mockedClient);

    githubClient.__set__({
      GitHub: mockedClientConstructor
    });

    mockedClient.authenticate = sinon.stub();
    mockedClient.repos = {
      getCommit: sinon.stub(),
      getContent: sinon.stub(),
      createHook: sinon.stub(),
      deleteHook: sinon.stub(),
      createStatus: sinon.stub()
    };
  });


  describe('getCommit', () => {
    it("should handle invalid token", function (done) {
      var invalidTokenError = new Error(" Invalid token");
      mockedClient.authenticate = sinon.stub().throws(invalidTokenError);
      new githubClient(githubVCS).getCommit('token', 'owner', 'repo', 'commit', (err, commit) => {
        should.exist(err);
        err.should.be.equal(invalidTokenError);
        done();
      });
    });

    it('should get commits', function (done) {
      mockedClient.repos.getCommit.callsArgWith(1, null, require('./fixtures/github_commit_payload.js'));

      new githubClient(githubVCS).getCommit('token', 'owner', 'repo', 'commit', (err, commit) => {
        should.not.exist(err);
        should.exist(commit);
        should.exist(commit.commitSha);
        should.exist(commit.title);
        should.exist(commit.author);
        should.exist(commit.commitUrl);
        should.exist(commit.compareUrl);
        done();
      });
    });
  });

  describe('getFileContents', () => {
    it("should handle invalid token", function (done) {
      var invalidTokenError = new Error(" Invalid token");
      mockedClient.authenticate = sinon.stub().throws(invalidTokenError);
      new githubClient(githubVCS).getFileContents('token', 'owner', 'repo', 'branch', 'filePath.txt', (err, fileContent) => {
        should.exist(err);
        err.should.be.equal(invalidTokenError);
        done();
      });
    });

    it('should get file contents', function (done) {
      mockedClient.repos.getContent.callsArgWith(1, null, {
        content: 'some file content.'
      });

      new githubClient(githubVCS).getFileContents('token', 'owner', 'repo', 'branch', 'filePath.txt', (err, fileContent) => {
        should.not.exist(err);
        should.exist(fileContent);
        fileContent.should.equal('some file content.');

        mockedClient.repos.getContent.calledOnce.should.be.true();
        var callOpts = mockedClient.repos.getContent.getCall(0).args[0];
        callOpts.user.should.equal('owner');
        callOpts.repo.should.equal('repo');
        callOpts.ref.should.equal('branch');
        callOpts.path.should.equal('filePath.txt');
        done();
      });
    });
  });

  describe('updatePRStatus', () => {

    it("should handle invalid token", function (done) {
      var invalidTokenError = new Error(" Invalid token");
      mockedClient.authenticate = sinon.stub().throws(invalidTokenError);
      new githubClient(githubVCS).updatePRStatus('token', 'owner', 'repo', 'sha1234', 'prState', 'description', (err, result) => {
        should.exist(err);
        err.should.be.equal(invalidTokenError);
        done();
      });
    });

    it('should update a PR status', (done) => {
      mockedClient.repos.createStatus.callsArgWith(1, null, 'result');

      new githubClient(githubVCS).updatePRStatus('token', 'owner', 'repo', 'sha1234', 'prState', 'description', (err, result) => {
        should.not.exist(err);
        should.exist(result);
        result.should.equal('result');

        mockedClient.repos.createStatus.calledOnce.should.be.true();
        var callOpts = mockedClient.repos.createStatus.getCall(0).args[0];
        callOpts.user.should.equal('owner');
        callOpts.repo.should.equal('repo');
        callOpts.sha.should.equal('sha1234');
        callOpts.state.should.equal('prState');
        callOpts.description.should.equal('description');
        callOpts.context.should.equal(utils.constants.System.Name);
        done();
      });
    });

    it('should not swallow errors on PR status update failure', function (done) {
      mockedClient.repos.createStatus.callsArgWith(1, new Error('awooga'), null);

      new githubClient(githubVCS).updatePRStatus('token', 'owner', 'repo', 'sha1234', 'prState', 'description', (err, result) => {
        should.exist(err);
        should.not.exist(result);

        err.message.should.equal('awooga');

        mockedClient.repos.createStatus.calledOnce.should.be.true();
        var callOpts = mockedClient.repos.createStatus.getCall(0).args[0];
        callOpts.user.should.equal('owner');
        callOpts.repo.should.equal('repo');
        callOpts.sha.should.equal('sha1234');
        callOpts.state.should.equal('prState');
        callOpts.description.should.equal('description');
        callOpts.context.should.equal(utils.constants.System.Name);
        done();
      });
    });
  });

  describe('deleteWebhook', () => {
    it('should delete a webhook', (done) => {
      mockedClient.repos.deleteHook.callsArgWith(1, null, mockedWebhook);

      new githubClient(githubVCS).deleteWebhook(mockedProject, (err) => {
        should.not.exist(err);
        mockedClient.repos.deleteHook.calledOnce.should.be.true();
        done();
      });
    });

    it('should fail when the web hook fails to delete', (done) => {
      mockedClient.repos.deleteHook.callsArgWith(1, {
        message: "error"
      });

      new githubClient(githubVCS).deleteWebhook(mockedProject, (err) => {
        should.exist(err);
        mockedClient.repos.deleteHook.calledOnce.should.be.true();
        done();
      });
    });
  });

  describe('addWebhook', () => {
    it('should create a webhook', (done) => {
      mockedClient.repos.createHook.callsArgWith(1, null, mockedWebhook);

      new githubClient(githubVCS).addWebhook(mockedProject, (err, result) => {
        should.not.exist(err);
        should.exist(result);
        mockedClient.repos.createHook.calledOnce.should.be.true();
        done();
      });
    });

    it('should throw an error when a webhook fails to create', (done) => {
      mockedClient.repos.createHook.callsArgWith(1, new Error('Failed to create web hook'), null);

      new githubClient(githubVCS).addWebhook(mockedProject, (err, result) => {
        should.not.exist(result);
        should.exist(err);
        mockedClient.repos.createHook.calledOnce.should.be.true();
        done();
      });
    });
  });
});
