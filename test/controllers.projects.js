var _ = require('lodash'),
  rewire = require('rewire'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  githubWebHookHelpers = require('../utils/vcs/github/webhookHelpers'),
  controller = rewire('../app/v2/projects/controller.js');

describe('v2/projects/controller', () => {
  var mockedRequest, mockedResponse, mockedNext, mockedUser, mockedProject, mockedError, mockedClient,
    mockedVCSProvider, mockedVCSProviderConstructor;
  var loggerLevel,
    bitbucketVCS = {
      vcs_type: {
        vcs_type: 'bitbucket'
      }
    },
    githubVCS = {
      api_url: 'https://api.github.com',
      browse_url: 'https://github.com',
      vcs_type: {
        vcs_type: 'github'
      }
    };

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    utils.database.connection = sinon.stub();
    utils.database.connection.encryptValue = (value) => {
      return `encrypted_${value}`;
    };

  });

  beforeEach(() => {
    mockedTarget = {
      id: '1',
      type: 'cloudfoundry',
      find: sinon.stub(),
      getProjects: sinon.stub(),
      get: sinon.stub(),
      addProjects: sinon.stub()
    };

    mockedRequest = {
      logger: utils.logger,
      params: {
        project_id: 1
      },
      db: {
        models: {
          notificationtarget: {
            create: sinon.stub()
          },
          project: {
            get: sinon.stub(),
            find: sinon.stub(),
            save: sinon.stub(),
            exists: sinon.stub(),
            create: sinon.stub()
          },
          user: {
            get: sinon.stub()
          },
          vcs: {
            get: sinon.stub()
          },
          deploymentTarget: mockedTarget
        }
      }
    };

    mockedResponse = {
      send: sinon.stub(),
      status: sinon.stub()
    };

    mockedUser = {
      user_id: 2
    };
    mockedProject = {
      id: 1,
      user_id: 2,
      getMembers: sinon.stub(),
      save: sinon.stub(),
      get: sinon.stub(),
      remove: sinon.stub(),
      setTargets: sinon.stub(),
      target: mockedTarget,
      name: 'My Project',
      vcs: {
        vcs_type: {
          vcs_type: "github"
        }
      },
      token: 'project-token',
      repo_webHookId: 1
    };

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');

    mockedClient = {
      addWebhook: sinon.stub().callsArgWith(1, null, {
        id: 1
      }),
      deleteWebhook: sinon.stub().callsArgWith(1, null, {
        id: 1
      }),
      refreshProjectToken: sinon.stub().callsArgWith(1, null, mockedProject)
    };
    mockedVCSProvider = {
      client: mockedClient,
      webhookHelpers: githubWebHookHelpers,
      pr_statusNotificationType: "githubpullrequest"
    };
    mockedVCSProviderConstructor = sinon.stub().returns(mockedVCSProvider);
    controller.__set__("utils.vcs", mockedVCSProviderConstructor);
    utils.database.connection.callsArgWith(0, null, mockedRequest.db);
  });

  describe('getProject', () => {
    it('should get a project for an owner', (done) => {
      mockedRequest.user = mockedUser;
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getMembers.callsArgWith(0, []);

      mockedResponse.send = (payload) => {
        mockedProject.getMembers.calledOnce.should.be.true();
        mockedNext.called.should.be.false();
        done();
      };

      controller.getProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should get a project for a member', (done) => {
      mockedRequest.user = mockedUser;
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getMembers.callsArgWith(0, [{
        id: 1
      }]);

      mockedResponse.send = (payload) => {
        mockedProject.getMembers.calledOnce.should.be.true();
        mockedNext.called.should.be.false();
        done();
      };

      controller.getProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return a 404 error for non-existent project', (done) => {
      mockedRequest.user = mockedUser;
      mockedRequest.db.models.project.get.callsArgWith(1, mockedError, mockedProject);
      mockedError.status = 404;

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.status.should.equal(404);
        err.message.should.equal(mockedError.message);

        mockedResponse.send.called.should.be.false();
        mockedProject.getMembers.called.should.be.false();
        done();
      };

      controller.getProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return a 404 error if the project exists but the user doesn\'t have access', (done) => {
      mockedUser.user_id = 99;
      mockedRequest.user = mockedUser;
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getMembers.callsArgWith(0, []);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.status.should.equal(404);
        err.message.should.equal('Access denied to resource id:1 for user id:99');

        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an unclassified error if ORM behaves unexpectedly', (done) => {
      mockedRequest.user = mockedUser;
      mockedRequest.db.models.project.get.callsArgWith(1, null, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error, and no project:1');

        mockedResponse.send.called.should.be.false();
        mockedProject.getMembers.called.should.be.false();
        done();
      };

      controller.getProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('listProjects', () => {
    var mockedUser, mockedProject2, mockedProject3, mockedProject4;

    beforeEach(() => {
      mockedUser = {
        user_id: 2,
        getMemberships: sinon.stub()
      };
      mockedRequest.user = mockedUser;
      mockedProject2 = {
        id: 2,
        user_id: 2
      };

      mockedProject3 = {
        id: 3,
        user_id: 3
      };

      mockedProject4 = {
        id: 4,
        user_id: 3
      };
    });

    it('should get a list of projects', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, [mockedProject, mockedProject2]);
      mockedRequest.db.models.user.get.callsArgWith(1, null, mockedUser);
      mockedUser.getMemberships.callsArgWith(0, null, [mockedProject3, mockedProject4]);

      mockedResponse.send = (payload) => {
        mockedRequest.db.models.user.get.calledOnce.should.be.true();
        mockedRequest.db.models.project.find.calledOnce.should.be.true();
        mockedRequest.db.models.project.get.called.should.be.false();
        payload.length.should.equal(4);
        payload[0].should.equal(mockedProject);
        payload[1].should.equal(mockedProject2);
        payload[2].should.equal(mockedProject3);
        payload[3].should.equal(mockedProject4);

        mockedNext.called.should.be.false();
        done();
      };

      controller.listProjects(mockedRequest, mockedResponse, mockedNext);
    });

    it('should get an empty list of projects for a non-owner non-member', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, []);
      mockedRequest.db.models.user.get.callsArgWith(1, null, mockedUser);
      mockedUser.getMemberships.callsArgWith(0, null, []);

      mockedResponse.send = (payload) => {
        mockedRequest.db.models.user.get.calledOnce.should.be.true();
        mockedRequest.db.models.project.find.calledOnce.should.be.true();
        mockedRequest.db.models.project.get.called.should.be.false();

        payload.length.should.equal(0);

        mockedNext.called.should.be.false();
        done();
      };

      controller.listProjects(mockedRequest, mockedResponse, mockedNext);
    });

    it('should get a list of projects without dupes', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, [mockedProject, mockedProject2, mockedProject3]);
      mockedRequest.db.models.user.get.callsArgWith(1, null, mockedUser);
      mockedUser.getMemberships.callsArgWith(0, null, [mockedProject2, mockedProject3, mockedProject4]);

      mockedResponse.send = (payload) => {
        mockedRequest.db.models.user.get.calledOnce.should.be.true();
        mockedRequest.db.models.project.find.calledOnce.should.be.true();
        mockedRequest.db.models.project.get.called.should.be.false();

        payload.length.should.equal(4);
        payload[0].should.equal(mockedProject);
        payload[1].should.equal(mockedProject2);
        payload[2].should.equal(mockedProject3);
        payload[3].should.equal(mockedProject4);

        mockedNext.called.should.be.false();
        done();
      };

      controller.listProjects(mockedRequest, mockedResponse, mockedNext);
    });

    it('should get a list of projects for a user who is only a member', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, []);
      mockedRequest.db.models.user.get.callsArgWith(1, null, mockedUser);
      mockedUser.getMemberships.callsArgWith(0, null, [mockedProject3, mockedProject4]);

      mockedResponse.send = (payload) => {
        mockedRequest.db.models.user.get.calledOnce.should.be.true();
        mockedRequest.db.models.project.find.calledOnce.should.be.true();
        mockedRequest.db.models.project.get.called.should.be.false();

        payload.length.should.equal(2);
        payload[0].should.equal(mockedProject3);
        payload[1].should.equal(mockedProject4);

        mockedNext.called.should.be.false();
        done();
      };

      controller.listProjects(mockedRequest, mockedResponse, mockedNext);
    });

    it('should get a list of projects for a user who is only an owner', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, [mockedProject, mockedProject2]);
      mockedRequest.db.models.user.get.callsArgWith(1, null, mockedUser);
      mockedUser.getMemberships.callsArgWith(0, null, []);

      mockedResponse.send = (payload) => {
        mockedRequest.db.models.user.get.calledOnce.should.be.true();
        mockedRequest.db.models.project.find.calledOnce.should.be.true();
        mockedRequest.db.models.project.get.called.should.be.false();

        payload.length.should.equal(2);
        payload[0].should.equal(mockedProject);
        payload[1].should.equal(mockedProject2);

        mockedNext.called.should.be.false();
        done();
      };

      controller.listProjects(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an unspecified error if unable to get projects by ownership', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, mockedError, null);
      mockedRequest.db.models.user.get.callsArgWith(1, null, mockedUser);
      mockedUser.getMemberships.callsArgWith(0, null, []);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);

        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.listProjects(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an unspecified error if unable to get projects by membership', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, []);
      mockedRequest.db.models.user.get.callsArgWith(1, mockedError, null);
      mockedUser.getMemberships.callsArgWith(0, null, []);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);

        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.listProjects(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an unspecified error if ORM behaves unexpectedly', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, []);
      mockedRequest.db.models.user.get.callsArgWith(1, null, null);
      mockedUser.getMemberships.callsArgWith(0, null, []);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error, and no user for id 2');

        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.listProjects(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('createProject', () => {

    beforeEach(() => {

      mockedRequest.body = {
          name: 'My Project',
          build_container_id: 2,
          user_id: 2,
          deployment_target_id: mockedTarget.id,
          token: 'asdf1234',
          vcs_id: 1,
          repo: {
            webHookId: '1',
            branch: 'branch',
            name: 'MyRepo'
          },
          branchRefName: 'branchName'
        },
        mockedRequest.user = mockedUser;
    });

    it('should create a project with valid data', (done) => {
      var mockedFind = sinon.stub();
      mockedProject.vcs = githubVCS;
      mockedProject.save = sinon.stub();
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, githubVCS);
      mockedProject.save.callsArgWith(0, null);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.notificationtarget.create.callsArgWith(1, null);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedResponse.status.returns(mockedResponse);
      mockedResponse.send = (createdProject) => {
        should.exist(createdProject);
        mockedProject.getVcs.calledWith({
          autoFetch: true,
          autoFetchLimit: 2
        }).should.be.true();
        mockedVCSProviderConstructor.calledWith(githubVCS).should.be.true();
        mockedVCSProvider.client.addWebhook.calledOnce.should.be.true();
        var createProjectParams = mockedRequest.db.models.project.create.getCall(0).args[0]
        createProjectParams.vcs_id.should.be.equal(1);
        mockedRequest.db.models.notificationtarget.create
          .calledWith({
            name: 'PR-status-notifier',
            type: 'githubpullrequest',
            location: 'https://api.dummyendpoint.org',
            token: 'encrypted_project-token',
            project_id: 1
          }).should.be.true();
        mockedNext.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should create webhook for bitbucket VCS provider', (done) => {
      var mockedFind = sinon.stub();
      mockedVCSProvider.pr_statusNotificationType = "bitbucketpullrequest"
      mockedVCSProviderConstructor = sinon.stub().returns(mockedVCSProvider);
      controller.__set__("utils.vcs", mockedVCSProviderConstructor);
      mockedProject.save = sinon.stub();
      mockedProject.save.callsArgWith(0, null);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, bitbucketVCS);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.notificationtarget.create.callsArgWith(1, null);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedResponse.status.returns(mockedResponse);
      mockedResponse.send = (createdProject) => {
        mockedVCSProviderConstructor.calledWith(bitbucketVCS).should.be.true();
        mockedProject.getVcs.calledWith({
          autoFetch: true,
          autoFetchLimit: 2
        }).should.be.true();
        mockedClient.addWebhook.calledOnce.should.be.true();
        mockedRequest.db.models.notificationtarget.create.calledOnce.should.be.true();
        mockedRequest.db.models.notificationtarget.create
          .calledWith({
            name: 'PR-status-notifier',
            type: 'bitbucketpullrequest',
            location: 'https://api.dummyendpoint.org',
            token: 'encrypted_project-token',
            project_id: 1
          }).should.be.true();
        should.exist(createdProject);
        mockedNext.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail if no webhook data is returned', (done) => {
      var mockedFind = sinon.stub();

      mockedClient.addWebhook.callsArgWith(1, null);

      mockedProject.save = sinon.stub();
      mockedProject.save.callsArgWith(0, null);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, bitbucketVCS);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.notificationtarget.create.callsArgWith(1, null);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedResponse.status.returns(mockedResponse);
      mockedNext = (err) => {
        should.exist(err);
        mockedClient.addWebhook.calledOnce.should.be.true;
        mockedResponse.status.called.should.be.false();
        err.message.should.equal('Unable to create web hook for project My Project.');
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle failure adding notification target', (done) => {
      var mockedFind = sinon.stub();

      mockedClient.addWebhook.callsArgWith(1, null);

      mockedProject.save = sinon.stub();
      mockedProject.save.callsArgWith(0, null);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, bitbucketVCS);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.notificationtarget.create.callsArgWith(1, {
        error: "OH NO!"
      });
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedResponse.status.returns(mockedResponse);
      mockedNext = (err) => {
        should.exist(err);
        mockedClient.addWebhook.calledOnce.should.be.true;
        mockedResponse.status.called.should.be.false();
        err.message.should.equal('Unable to create web hook for project My Project.');
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail to create a project without a name', (done) => {
      mockedRequest.body.name = '';
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: name.');
        err.status.should.equal(400);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail to create a project without a build_container_id', (done) => {
      delete mockedRequest.body.build_container_id;
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: build_container_id.');
        err.status.should.equal(400);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail to create a project without a branch', (done) => {
      mockedRequest.body.branchRefName = '';
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: repo_branch.');
        err.status.should.equal(400);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail to create a project without targets', (done) => {
      delete mockedRequest.body.deployment_target_id;
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, null);
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: target.');
        err.status.should.equal(400);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should error when validation cannot get a target', (done) => {
      var mockedFind = sinon.stub();
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, mockedError, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a target can\'t find a project', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.find.callsArgWith(1, null, mockedTarget);
      mockedTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, mockedError, null);
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a project exists fails', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.find.callsArgWith(1, null, mockedTarget);
      mockedTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, mockedError, null);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, mockedError, null);
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a project name exists', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.find.callsArgWith(1, null, mockedTarget);
      mockedTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, true);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, mockedError, null);
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: name.')
        err.details.should.equal(`Project name 'My Project' is already in use.`);
        err.status.should.equal(400);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a branch is already targeted by another project', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.find.callsArgWith(1, null, mockedTarget);
      mockedTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, [mockedProject]);
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.status.should.equal(400);
        err.should.be.an.instanceOf(utils.errors.BadRequestError);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: repo.branch.');
        err.details.should.equal(`Branch '${mockedRequest.body.branchRefName}' in repo '${mockedRequest.body.repo.name}'
 is already targeted for deployment in this target by the '${mockedProject.name }'
 project. Please select another target target.`);

        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a project cannot be saved', (done) => {
      var mockedFind = sinon.stub();
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, null);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('Unable to save project My Project, no ORM error.');
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when cannot get target', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.create.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, mockedError, null);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.createProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('updateProject', () => {

    beforeEach(() => {
      mockedRequest.body = {
        name: 'My Project',
        build_container_id: 2,
        application_image_id: 12,
        deployment_target_id: mockedTarget.id,
        token: 'asdf1234',
        repo: {
          webHookId: '1',
          branch: 'branch'
        },
        branchRefName: 'branchName'
      };
    });

    it('should update a project with valid data', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.get.callsArgWith(1, null, mockedTarget);
      mockedProject.save.callsArgWith(0, null, []);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedResponse.send = (createdProject) => {
        should.exist(createdProject);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        done();
      };

      controller.updateProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should update a project repo with branchRefName', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.find.callsArgWith(1, null, mockedTarget);

      mockedRequest.body = {
        name: 'My Project',
        build_container_id: 2,
        application_image_id: 12,
        deployment_target_id: mockedTarget.id,
        token: 'asdf1234',
        branchRefName: 'branchName'
      };

      mockedProject.save.callsArgWith(0, null, []);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedResponse.send = (createdProject) => {
        should.exist(createdProject);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        done();
      };

      controller.updateProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should update a project build_container', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.find.callsArgWith(1, null, mockedTarget);

      mockedRequest.body = {
        name: 'My Project',
        build_container_id: 2,
        application_image_id: 12,
        build_container_id: 16,
        some_flag: 'foobar',
        branchRefName: "master",
        deployment_target_id: mockedTarget.id,
        token: 'asdf1234'
      };

      mockedProject.save.callsArgWith(0, null);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedResponse.send = (updatedProject) => {
        should.exist(updatedProject);
        updatedProject.build_container_id.should.be.equal(16);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        done();
      };

      controller.updateProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should update a project vcs', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.find.callsArgWith(1, null, mockedTarget);

      mockedRequest.body = {
        name: 'My Project',
        build_container_id: 2,
        application_image_id: 12,
        build_container_id: 16,
        vcs_id: 999,
        some_flag: 'foobar',
        branchRefName: "master",
        deployment_target_id: mockedTarget.id,
        token: 'asdf1234'
      };

      mockedProject.save.callsArgWith(0, null);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedResponse.send = (updatedProject) => {
        should.exist(updatedProject);
        updatedProject.vcs_id.should.be.equal(999);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        done();
      };

      controller.updateProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should retain token when updating a project repo', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.find.callsArgWith(1, null, mockedTarget);
      mockedRequest.body = {
        name: 'My Project',
        build_container_id: 2,
        application_image_id: 12,
        deployment_target_id: mockedTarget.id,
        branchRefName: 'branchName'
      };

      mockedProject.save.callsArgWith(0, null, []);
      mockedProject.token = 'set_before_test';
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.get.callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedResponse.send = (savedProject) => {
        should.exist(savedProject);
        should.exist(savedProject.token, "Token should not be set to null");
        savedProject.token.should.be.equal('set_before_test');
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        done();
      };

      controller.updateProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an ORM error for no project found', (done) => {
      mockedRequest.db.models.project.get.callsArgWith(1, null, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error, and no project:1');
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return error when target isn\'t found', (done) => {
      var mockedFind = sinon.stub();
      mockedTarget.get.callsArgWith(1, null, null);
      mockedProject.save.callsArgWith(0, null, []);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedRequest.db.models.project.exists.callsArgWith(1, null, false);
      mockedRequest.db.models.deploymentTarget.find.onFirstCall().callsArgWith(1, null, mockedTarget);
      mockedRequest.db.models.deploymentTarget.find.onSecondCall().callsArgWith(1, null, []);
      mockedRequest.db.models.deploymentTarget.getProjects.returns({
        find: mockedFind
      });
      mockedFind.callsArgWith(1, null, {
        rows: 0
      });

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: target.');
        mockedResponse.send.called.should.be.false();
        done();
      };


      controller.updateProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('deleteProject', () => {
    it('should delete a project', (done) => {

      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, githubVCS);
      mockedProject.remove.callsArgWith(0, null);
      mockedResponse.send = () => {
        mockedVCSProvider.client.refreshProjectToken.calledOnce.should.be.true();
        mockedResponse.status.calledWith(httpStatus.NO_CONTENT).should.be.true();
        done();
      };

      controller.deleteProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should delete a project with a webhook id, but no webhook on github', (done) => {
      mockedClient.deleteWebhook.callsArgWith(1, {
        code: 404
      }, null);

      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, githubVCS);
      mockedProject.remove.callsArgWith(0, null);
      mockedResponse.send = () => {
        mockedVCSProvider.client.refreshProjectToken.calledOnce.should.be.true();
        mockedResponse.status.calledWith(httpStatus.NO_CONTENT).should.be.true();
        done();
      };

      controller.deleteProject(mockedRequest, mockedResponse, mockedNext);
    });


    it('should delete a project without a webhook', (done) => {

      mockedProject.repo_webHookId = undefined;

      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, githubVCS);
      mockedProject.remove.callsArgWith(0, null);
      mockedResponse.send = () => {
        mockedVCSProvider.client.refreshProjectToken.calledOnce.should.be.false();
        mockedResponse.status.calledWith(httpStatus.NO_CONTENT).should.be.true();
        mockedClient.deleteWebhook.called.should.be.false();
        done();
      };

      controller.deleteProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail when a VCS can\'t be retrieved, ORM misbehaving', (done) => {

      mockedClient.deleteWebhook.callsArgWith(1, new Error('Failed to remove webhook'));

      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null);
      mockedProject.remove.callsArgWith(0, null);
      mockedNext = (err) => {
        err.message.should.be.equal("Unable to retrieve vcs for project My Project, no ORM error.");
        done();
      };

      controller.deleteProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail when a VCS can\'t be retrieved, error retreiving', (done) => {
      var retrieveError = new Error("Unable to find VCS instance");
      mockedClient.deleteWebhook.callsArgWith(1, new Error('Failed to remove webhook'));

      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, retrieveError);
      mockedProject.remove.callsArgWith(0, null);
      mockedNext = (err) => {
        err.message.should.be.equal("Unable to find VCS instance");
        done();
      };

      controller.deleteProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail when a webhook can\'t be deleted', (done) => {

      mockedClient.deleteWebhook.callsArgWith(1, new Error('Failed to remove webhook'));

      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, githubVCS);
      mockedProject.remove.callsArgWith(0, null);
      mockedNext = (err) => {
        err.message.should.be.equal("Failed to remove webhook");
        done();
      };

      controller.deleteProject(mockedRequest, mockedResponse, mockedNext);
    });


    it('should return a project not found error', (done) => {
      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.project.get.callsArgWith(1, null, null);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, githubVCS);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error, and no project:1');
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.deleteProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return a project remove error', (done) => {

      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getVcs = sinon.stub().callsArgWith(1, null, githubVCS);
      mockedProject.remove.callsArgWith(0, mockedError);
      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.deleteProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getStatistics', () => {
    it('should get statistics', (done) => {
      mockedRequest.db = {};
      mockedRequest.db.driver = {};
      mockedRequest.db.driver.execQuery = sinon.stub();
      mockedRequest.db.driver.execQuery.callsArgWith(2, null, [1]);

      mockedResponse.send = (results) => {
        should.exist(results);
        mockedNext.called.should.be.false();

        mockedRequest.db.driver.execQuery.getCall(0).calledWith(
          `select b.id, bs.endDate, b.message, b.reason_type as 'reason',
      b.reason_commitSha as 'sha', bs.type as 'type'  from build as b,
      build_step as bs  where bs.build_id=b.id and b.project_id=?
      and (bs.type=? and bs.state='succeeded')  and (reason_type='push'
      or reason_type='manual') order by b.reason_createdDate desc limit 1`, [mockedRequest.params.project_id, 'Building']
        ).should.be.true();

        mockedRequest.db.driver.execQuery.getCall(1).calledWith(
          `select b.id, bs.endDate, b.message, b.reason_type as 'reason',
      b.reason_commitSha as 'sha', bs.type as 'type'  from build as b,
      build_step as bs  where bs.build_id=b.id and b.project_id=?
      and (bs.type=? and bs.state='succeeded')  and (reason_type='push'
      or reason_type='manual') order by b.reason_createdDate desc limit 1`, [mockedRequest.params.project_id, 'Testing']
        ).should.be.true();

        mockedRequest.db.driver.execQuery.getCall(2).calledWith(
          `select b.id, bs.endDate, b.message, b.reason_type as 'reason',
      b.reason_commitSha as 'sha', bs.type as 'type'  from build as b,
      build_step as bs  where bs.build_id=b.id and b.project_id=?
      and (bs.type=? and bs.state='succeeded')  and (reason_type='push'
      or reason_type='manual') order by b.reason_createdDate desc limit 1`, [mockedRequest.params.project_id, 'Deploying']
        ).should.be.true();

        done();
      };

      controller.getStatistics(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when no data is returned', (done) => {
      mockedRequest.db = {};
      mockedRequest.db.driver = {};
      mockedRequest.db.driver.execQuery = sinon.stub();
      mockedRequest.db.driver.execQuery.callsArgWith(2, null, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM return no data and no error for custom statistics query.');
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.getStatistics(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
