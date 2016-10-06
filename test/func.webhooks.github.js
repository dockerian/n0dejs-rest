var _ = require('lodash'),
  fs = require('fs'),
  http = require('http'),
  httpStatus = require('http-status-codes'),
  request = require('request'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  testHelpers = require('./_helpers.js'),
  githubVCS = require('../utils/vcs/github'),
  controller = require('../app/v2/hooks/controller.js'),
  dockerImages = require('./docker_images.js');

describe('func/webhooks/github', () => {
  var nodeJSBuildContainer = {
      "build_container_label": "foobar/foo-base-nodejs",
      "retain_build_artifacts": true,
      "image": {
        "image_repo": "foobar/foo-base-nodejs",
        "credential": {
          "credential_key": "dockerhub_user",
          "credential_value": "dockerhub_password",
          "credential_extra": "dockerhub_email@email.com"
        },
        "image_tag": "kosher-prod"
      }
    },
    server;
  var mockedRequest, mockedNext, mockedVCSProvider, mockedVCSProviderConstructor;
  var mockedProject, mockedTarget, mockedExecution, mockedDeployment, githubVCSType;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    process.env = {
      DOCKER_USERNAME: 'dockerhub_user',
      DOCKER_PASSWORD: 'dockerhub_password',
      DOCKER_EMAIL: 'dockerhub_email@email.com',
      CONCOURSE_ENDPOINT: 'http://myconcourse.ci:8080',
      CONCOURSE_USERNAME: 'concourse_user',
      CONCOURSE_PASSWORD: 'concourse_password',
      GITHUB_CLIENT_ID: 'github_client_id_1234',
      GITHUB_CLIENT_SECRET: 'github_client_secret_5678',
      WEB_URI: '192.168.1.2',
      PUBLIC_API_URL: 'http://api.n0dejs.com/v2',
      API_HOST: '192.168.1.3:3001',
      NGROK_AUTHTOKEN: 'ngrok_token',
      HCP_IDENTITY_SCHEME: 'https',
      HCP_IDENTITY_PORT: 443,
      HCP_IDENTITY_HOST: 'api.uaa.endpoint.com'
    };

    testHelpers.refreshSettings();
    testHelpers.refreshConstants();
  });

  after((done) => {
    testHelpers.refreshSettings();
    testHelpers.cleanUpPipelineFiles(done);
  });

  describe('githubWebhookHandler', () => {
    beforeEach(() => {
      mockedVCSProvider = new githubVCS();

      mockedVCSProvider.client.updatePRStatus = sinon.stub().callsArgWith(6, null);
      mockedVCSProviderConstructor = sinon.stub().returns(mockedVCSProvider);
      utils.vcs = mockedVCSProviderConstructor;
      utils.database.connection = sinon.stub();

      githubVCSType = {
        api_url: 'https://api.github.com',
        browse_url: 'https://github.com',
        skip_ssl_validation: false,
        vcs_type: {
          vcs_type: 'github'
        }
      };

      mockedRequest = {
        logger: utils.logger,
        params: {
          project_id: 1
        },
        body: 'set_me_in_test',
        db: {
          models: {
            // usage of .project(id).find...
            project: sinon.stub(),
            deployment: {
              findByBuild: sinon.stub()
            },
            build: {
              create: 'set_me_in_test'
            }
          }
        }
      };

      // usage of .project.get(id, ...)
      mockedRequest.db.models.project.get = sinon.stub();

      mockedProject = {
        id: 1,
        type: 'nodejs',
        vcs: {
          api_url: "https://api.github.com",
          vcs_type: {
            vcs_type: "github"
          }
        },
        repo_owner: 'repo_owner',
        repo_name: 'repo_name',
        repo_branch: 'master',
        repo: {
          owner: 'repo_owner',
          name: 'name',
          branch: 'master'
        },
        token: 'a_project_token',
        repo_secret: 'a_project_secret',
        getVcs: sinon.stub(),
        getDeploymentTarget: sinon.stub(),
        getNotificationTargets: sinon.stub(),
        getPipelineTasks: sinon.stub(),
        getApplicationImage: sinon.stub(),
        getBuildContainer: sinon.stub()
      };

      mockedTarget = {
        id: 2,
        skip_ssl_validation: true
      };

      mockedExecution = {
        id: 3,
        reason_type: "manual",
        save: sinon.stub()
      };

      mockedDeployment = {
        remove: sinon.stub()
      };

      mockedNext = sinon.stub();
      mockedVCSProvider.client.refreshedProject = sinon.stub().callsArgWith(1, mockedProject);
      utils.systemImages = {
        loadImages: sinon.stub().callsArgWith(0, null),
        images: sinon.stub().returns(dockerImages)
      };

    });

    afterEach((done) => {
      if (server) {
        return server.close(done);
      }
      return done();
    });

    describe("Push as application source code archive", () => {

      it('should execute fly command with valid pipeline based on push webhook event', (done) => {
        var pipelineId, didComparePipelineFiles = false,
          githubStatusNT = {
            id: 12,
            'type': "githubpullrequest",
            'token': "Github_token"
          };

        utils.database.connection.callsArgWith(0, null, function () {
          utils.database.connection.decryptValue = sinon.stub().returns("a_project_secret");
          return mockedRequest.db;
        }());
        utils.settings.getSystemConfigurationValue = sinon.stub().callsArgWith(1, null, "1");

        mockedRequest.body = require('./fixtures/func.webhooks.github/push_request_payload.json');
        mockedRequest.headers = {
          'x-github-event': 'push',
          'x-hub-signature': 'sha1=886176dfba69d708e18efd1728157ff8559275b2'
        };

        mockedRequest.db.models.project.returns(mockedProject);
        mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
        mockedRequest.db.models.build.create = (execution, cb) => {
          // we do this to copy the concourse_execution_id
          should.exist(execution.name);
          should.exist(execution.message);
          _.extend(mockedExecution, execution);
          return cb(null, mockedExecution);
        };

        mockedProject.getPipelineTasks.callsArgWith(0, null, []);
        mockedProject.getNotificationTargets.callsArgWith(0, null, [githubStatusNT]);
        mockedProject.getApplicationImage.callsArgWith(1, null, null);
        mockedProject.getBuildContainer.callsArgWith(1, null, nodeJSBuildContainer);
        mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedTarget);
        mockedProject.getVcs.callsArgWith(1, null, githubVCSType);
        mockedExecution.save.callsArgWith(0);

        // call this when calling shell.exec from the concourse client.
        require('shelljs').exec = (command, opts, cb) => {
          testHelpers.validateConcoursePipeline(command, 'func.webhooks.github', 'push', (pid) => {
            pipelineId = pipelineId || pid;
            didComparePipelineFiles = true;
            return cb(0, '');
          });
        }

        serverHelper(controller.githubWebhookHandler, (res) => {
          var body = JSON.parse(res.body);

          res.statusCode.should.equal(httpStatus.ACCEPTED);
          body.should.equal('Build Request Accepted');
          didComparePipelineFiles.should.be.true();
          mockedNext.called.should.be.false();

          // check we're not making excessive db calls
          mockedRequest.db.models.project.get.calledOnce.should.be.true();
          mockedProject.getNotificationTargets.calledOnce.should.be.true();
          mockedProject.getPipelineTasks.calledOnce.should.be.true();
          mockedProject.getDeploymentTarget.calledOnce.should.be.true();

          mockedExecution.save.calledOnce.should.be.true();
          mockedExecution.concourse_pipeline_id.should.equal(pipelineId);

          testHelpers.checkPipelineFile(
            mockedExecution.concourse_pipeline_id).should.be.false(
            `Should not exist *_${mockedExecution.concourse_pipeline_id}.yml`);

          done();
        });
      });

      it('should execute fly command with valid pipeline based on pull_request webhook event', (done) => {
        var pipelineId, didComparePipelineFiles = false,
          githubStatusNT = {
            id: 12,
            'type': "githubpullrequest",
            'token': "Github_token"
          };

        utils.database.connection.callsArgWith(0, null, function () {
          utils.database.connection.decryptValue = sinon.stub().returns("a_project_secret");
          return mockedRequest.db;
        }());
        mockedVCSProvider.client.updatePRStatus.callsArgWith(6, null);

        mockedRequest.body = require('./fixtures/func.webhooks.github/pull_request_payload.json');
        mockedRequest.headers = {
          'x-github-event': 'pull_request',
          'x-hub-signature': 'sha1=8902c88124e1efc15b573b6a831958fd8fa1fe83'
        };

        githubVCSType.skip_ssl_validation = true;
        mockedProject.getVcs.callsArgWith(1, null, githubVCSType);
        mockedProject.getApplicationImage.callsArgWith(1, null, null);
        mockedProject.getBuildContainer.callsArgWith(1, null, nodeJSBuildContainer);
        mockedProject.getNotificationTargets.callsArgWith(0, null, [githubStatusNT]);
        mockedProject.getPipelineTasks.callsArgWith(0, null, []);
        mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedTarget);

        mockedRequest.db.models.project.returns(mockedProject);
        mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
        mockedRequest.db.models.build.create = (execution, cb) => {
          // we do this to copy the concourse_execution_id
          should.exist(execution.name);
          should.exist(execution.message);
          _.extend(mockedExecution, execution);
          return cb(null, mockedExecution);
        };

        mockedExecution.save.callsArgWith(0);

        // call this when calling shell.exec from the concourse client.
        require('shelljs').exec = (command, opts, cb) => {
          testHelpers.validateConcoursePipeline(command, 'func.webhooks.github', 'pull_request', (pid) => {
            pipelineId = pipelineId || pid;
            didComparePipelineFiles = true;
            return cb(0, '');
          });
        }

        serverHelper(controller.githubWebhookHandler, (res) => {
          var body = JSON.parse(res.body);

          res.statusCode.should.equal(httpStatus.ACCEPTED);
          body.should.equal('Build Request Accepted');
          didComparePipelineFiles.should.be.true();
          mockedNext.called.should.be.false();

          // check we're not making excessive db calls
          mockedRequest.db.models.project.get.calledOnce.should.be.true();
          mockedProject.getNotificationTargets.calledOnce.should.be.true();
          mockedProject.getPipelineTasks.calledOnce.should.be.true();
          mockedProject.getDeploymentTarget.calledOnce.should.be.true();

          mockedExecution.save.calledOnce.should.be.true();
          mockedExecution.concourse_pipeline_id.should.equal(pipelineId);

          testHelpers.checkPipelineFile(
            mockedExecution.concourse_pipeline_id).should.be.false(
            `Should not exist *_${mockedExecution.concourse_pipeline_id}.yml`);

          mockedVCSProvider.client.updatePRStatus.calledOnce.should.be.true();
          mockedVCSProvider.client.updatePRStatus.calledWith(
            mockedProject.token,
            mockedProject.repo_owner,
            mockedProject.repo_name,
            '905b1afee58c6d3ff3cde0bce243a1f9cb9623ac',
            'pending',
            'Starting Build'
          ).should.be.true();

          done();
        });
      });

      it('should execute fly command with valid pipeline based on pull_request closed webhook event', (done) => {
        var pipelineId, didComparePipelineFiles = false;

        utils.database.connection.callsArgWith(0, null, function () {
          utils.database.connection.decryptValue = sinon.stub().returns("a_project_secret");
          return mockedRequest.db;
        }());

        mockedRequest.body = require('./fixtures/func.webhooks.github/pull_request_closed_payload.json');
        mockedRequest.headers = {
          'x-github-event': 'pull_request',
          'x-hub-signature': 'sha1=815a6d93dbd1a1f8a124da44c04e10323fd2ac6f'
        };

        mockedRequest.db.models.project.returns(mockedProject);
        mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
        mockedRequest.db.models.deployment.findByBuild.returns(mockedDeployment);
        mockedRequest.db.models.build.create = (execution, cb) => {
          // we do this to copy the concourse_execution_id
          _.extend(mockedExecution, execution);
          return cb(null, mockedExecution);
        };
        mockedProject.getVcs.callsArgWith(1, null, githubVCSType);
        mockedProject.getNotificationTargets.callsArgWith(0, null, []);
        mockedProject.getPipelineTasks.callsArgWith(0, null, []);
        mockedProject.getApplicationImage.callsArgWith(1, null, null);
        mockedProject.getBuildContainer.callsArgWith(1, null, nodeJSBuildContainer);
        mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedTarget);
        mockedDeployment.remove.callsArgWith(0, null);
        mockedExecution.save.callsArgWith(0);

        // call this when calling shell.exec from the concourse client.
        require('shelljs').exec = (command, opts, cb) => {
          testHelpers.validateConcoursePipeline(command, 'func.webhooks.github', 'pull_request_closed', (pid) => {
            pipelineId = pipelineId || pid;
            didComparePipelineFiles = true;
            return cb(0, '');
          });
        }

        serverHelper(controller.githubWebhookHandler, (res) => {
          var body = JSON.parse(res.body);

          res.statusCode.should.equal(httpStatus.ACCEPTED);
          body.should.equal('Build Request Accepted');
          didComparePipelineFiles.should.be.true();
          mockedNext.called.should.be.false();

          // check we're not making excessive db calls
          mockedRequest.db.models.project.get.calledOnce.should.be.true();
          mockedProject.getNotificationTargets.calledOnce.should.be.true();
          mockedProject.getPipelineTasks.calledOnce.should.be.true();
          mockedProject.getDeploymentTarget.calledOnce.should.be.true();

          mockedExecution.save.calledOnce.should.be.true();
          mockedExecution.concourse_pipeline_id.should.equal(pipelineId);

          testHelpers.checkPipelineFile(
            mockedExecution.concourse_pipeline_id).should.be.false(
            `Should not exist *_${mockedExecution.concourse_pipeline_id}.yml`);

          mockedRequest.db.models.deployment.findByBuild.calledOnce.should.be.true();
          mockedRequest.db.models.deployment.findByBuild.getCall(0).args[0].reason_pr_id.should.equal(1);
          mockedDeployment.remove.calledOnce.should.be.true();

          done();
        });
      });
    });

    describe("Project has custom build container", () => {
      it('should execute fly command with valid pipeline based on push webhook event', (done) => {
        var pipelineId, didComparePipelineFiles = false,
          customBuildContainer = {
            build_container_label: 'custom-java-build-pack',
            retain_build_artifacts: true,
            image: {
              image_repo: "customer/custom-java-build-pack",
              image_tag: "latest",
              credential: {
                credential_key: "user-name",
                credential_value: "password",
                credential_extra: "email@email.com"
              }
            }
          };

        utils.database.connection.callsArgWith(0, null, function () {
          utils.database.connection.decryptValue = sinon.stub().returns("a_project_secret");
          return mockedRequest.db;
        }());

        mockedRequest.body = require('./fixtures/func.webhooks.github/push_request_payload.json');
        mockedRequest.headers = {
          'x-github-event': 'push',
          'x-hub-signature': 'sha1=886176dfba69d708e18efd1728157ff8559275b2'
        };

        mockedProject = {
          id: 1,
          name: 'sample-app',
          vcs: {
            api_url: "https://api.github.com",
            vcs_type: {
              vcs_type: "github"
            }
          },
          repo_owner: 'repo_owner',
          repo_name: 'repo_name',
          repo_cloneUrl: 'https://github.com/flacnut/node-docker-hello',
          repo_branch: 'master',
          token: 'a_project_token',
          repo_secret: 'a_project_secret',
          getVcs: sinon.stub(),
          getDeploymentTarget: sinon.stub(),
          getNotificationTargets: sinon.stub(),
          getPipelineTasks: sinon.stub(),
          getApplicationImage: sinon.stub().callsArgWith(1, null, null),
          getBuildContainer: sinon.stub().callsArgWith(1, null, customBuildContainer)
        };

        mockedRequest.db.models.project.returns(mockedProject);
        mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
        mockedRequest.db.models.build.create = (execution, cb) => {
          // we do this to copy the concourse_execution_id
          _.extend(mockedExecution, execution);
          return cb(null, mockedExecution);
        };

        mockedProject.getNotificationTargets.callsArgWith(0, null, []);
        mockedProject.getPipelineTasks.callsArgWith(0, null, []);
        mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedTarget);
        mockedExecution.save.callsArgWith(0);
        mockedProject.getVcs.callsArgWith(1, null, githubVCSType);
        // call this when calling shell.exec from the concourse client.
        require('shelljs').exec = (command, opts, cb) => {
          testHelpers.validateConcoursePipeline(command, 'func.webhooks.github', 'build_push_in_custom_build_container', (pid) => {
            pipelineId = pipelineId || pid;
            didComparePipelineFiles = true;
            return cb(0, '');
          });
        }

        serverHelper(controller.githubWebhookHandler, (res) => {
          var body = JSON.parse(res.body);

          res.statusCode.should.equal(httpStatus.ACCEPTED);
          body.should.equal('Build Request Accepted');
          didComparePipelineFiles.should.be.true();
          mockedNext.called.should.be.false();

          // check we're not making excessive db calls
          mockedRequest.db.models.project.get.calledOnce.should.be.true();
          mockedProject.getNotificationTargets.calledOnce.should.be.true();
          mockedProject.getPipelineTasks.calledOnce.should.be.true();
          mockedProject.getDeploymentTarget.calledOnce.should.be.true();
          mockedProject.getApplicationImage.calledOnce.should.be.true();

          mockedExecution.save.calledOnce.should.be.true();
          mockedExecution.concourse_pipeline_id.should.equal(pipelineId);

          testHelpers.checkPipelineFile(
            mockedExecution.concourse_pipeline_id).should.be.false(
            `Should not exist *_${mockedExecution.concourse_pipeline_id}.yml`);

          done();
        });
      }).timeout(5000);

      it('should execute fly command with valid pipeline containing user docker image based on pull_request webhook event', (done) => {
        var pipelineId, didComparePipelineFiles = false,
          customBuildContainer = {
            build_container_label: 'custom-java-build-pack',
            retain_build_artifacts: true,
            image: {
              image_repo: "customer/custom-java-build-pack",
              image_tag: "latest",
              credential: {
                username: "user-name",
                password: "password",
                email: "email@email.com"
              }
            }
          },
          githubStatusNT = {
            id: 12,
            'type': "githubpullrequest",
            'token': "Github_token"
          };

        utils.database.connection.callsArgWith(0, null, function () {
          utils.database.connection.decryptValue = sinon.stub().returns("a_project_secret");
          return mockedRequest.db;
        }());
        // mockedVCSProvider.client.updatePRStatus.callsArgWith(6, null);

        mockedRequest.body = require('./fixtures/func.webhooks.github/pull_request_payload.json');
        mockedRequest.headers = {
          'x-github-event': 'pull_request',
          'x-hub-signature': 'sha1=8902c88124e1efc15b573b6a831958fd8fa1fe83'
        };
        mockedProject = {
          id: 1,
          name: 'sample-app',
          type: 'nodejs',
          vcs: {
            api_url: "https://api.github.com",
            vcs_type: {
              vcs_type: "github"
            }
          },
          repo_owner: 'repo_owner',
          repo_name: 'repo_name',
          repo: {
            owner: 'owner',
            name: 'name',
            branch: 'branch'
          },
          repo_cloneUrl: 'https://github.com/flacnut/node-docker-hello',
          repo_branch: 'master',
          token: 'a_project_token',
          repo_secret: 'a_project_secret',
          getVcs: sinon.stub(),
          getDeploymentTarget: sinon.stub(),
          getNotificationTargets: sinon.stub(),
          getPipelineTasks: sinon.stub(),
          getApplicationImage: sinon.stub().callsArgWith(1, null, null),
          getBuildContainer: sinon.stub().callsArgWith(1, null, customBuildContainer)
        };

        mockedProject.getVcs.callsArgWith(1, null, githubVCSType);
        mockedRequest.db.models.project.returns(mockedProject);
        mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
        mockedRequest.db.models.build.create = (execution, cb) => {
          // we do this to copy the concourse_execution_id
          _.extend(mockedExecution, execution);
          return cb(null, mockedExecution);
        };

        mockedProject.getNotificationTargets.callsArgWith(0, null, [githubStatusNT]);
        mockedProject.getPipelineTasks.callsArgWith(0, null, []);
        mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedTarget);
        mockedExecution.save.callsArgWith(0);

        // call this when calling shell.exec from the concourse client.
        require('shelljs').exec = (command, opts, cb) => {
          testHelpers.validateConcoursePipeline(command, 'func.webhooks.github', 'build_pull_request_in_custom_build_container', (pid) => {
            pipelineId = pipelineId || pid;
            didComparePipelineFiles = true;
            return cb(0, '');
          });
        }

        serverHelper(controller.githubWebhookHandler, (res) => {
          var body = JSON.parse(res.body);

          res.statusCode.should.equal(httpStatus.ACCEPTED);
          body.should.equal('Build Request Accepted');
          didComparePipelineFiles.should.be.true();
          mockedNext.called.should.be.false();

          // check we're not making excessive db calls
          mockedRequest.db.models.project.get.calledOnce.should.be.true();
          mockedProject.getNotificationTargets.calledOnce.should.be.true();
          mockedProject.getPipelineTasks.calledOnce.should.be.true();
          mockedProject.getDeploymentTarget.calledOnce.should.be.true();

          mockedExecution.save.calledOnce.should.be.true();
          mockedExecution.concourse_pipeline_id.should.equal(pipelineId);

          testHelpers.checkPipelineFile(
            mockedExecution.concourse_pipeline_id).should.be.false(
            `Should not exist *_${mockedExecution.concourse_pipeline_id}.yml`);

          mockedVCSProvider.client.updatePRStatus.calledOnce.should.be.true();
          mockedVCSProvider.client.updatePRStatus.calledWith(
            mockedProject.token,
            mockedProject.repo_owner,
            mockedProject.repo_name,
            '905b1afee58c6d3ff3cde0bce243a1f9cb9623ac',
            'pending',
            'Starting Build'
          ).should.be.true();

          done();
        });
      });
    });

    describe("Push as Docker image", () => {
      it('should execute fly command with valid pipeline containing user docker image based on push webhook event', (done) => {
        var pipelineId, didComparePipelineFiles = false,
          mockedApplicationImage = {
            image_repo: "n0dejsapi/sample-app",
            image_tag: "prod",
            credential: {
              username: "user-name",
              password: "password",
              email: "email@email.com"
            }
          };

        utils.database.connection.callsArgWith(0, null, function () {
          utils.database.connection.decryptValue = sinon.stub().returns("a_project_secret");
          return mockedRequest.db;
        }());

        mockedRequest.body = require('./fixtures/func.webhooks.github/push_request_payload.json');
        mockedRequest.headers = {
          'x-github-event': 'push',
          'x-hub-signature': 'sha1=886176dfba69d708e18efd1728157ff8559275b2'
        };

        mockedProject = {
          id: 1,
          name: 'sample-app',
          type: 'nodejs',
          vcs: {
            api_url: "https://api.github.com",
            vcs_type: {
              vcs_type: "github"
            }
          },
          repo_owner: 'repo_owner',
          repo_name: 'repo_name',
          repo_cloneUrl: 'https://github.com/flacnut/node-docker-hello',
          repo_branch: 'master',
          token: 'a_project_token',
          repo_secret: 'a_project_secret',
          getVcs: sinon.stub(),
          getDeploymentTarget: sinon.stub(),
          getNotificationTargets: sinon.stub(),
          getPipelineTasks: sinon.stub(),
          getApplicationImage: sinon.stub().callsArgWith(1, null, mockedApplicationImage),
          getBuildContainer: sinon.stub().callsArgWith(1, null, nodeJSBuildContainer)
        };

        mockedRequest.db.models.project.returns(mockedProject);
        mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
        mockedRequest.db.models.build.create = (execution, cb) => {
          // we do this to copy the concourse_execution_id
          _.extend(mockedExecution, execution);
          return cb(null, mockedExecution);
        };

        mockedProject.getNotificationTargets.callsArgWith(0, null, []);
        mockedProject.getPipelineTasks.callsArgWith(0, null, []);
        mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedTarget);
        mockedExecution.save.callsArgWith(0);
        mockedProject.getVcs.callsArgWith(1, null, githubVCSType);
        // call this when calling shell.exec from the concourse client.
        require('shelljs').exec = (command, opts, cb) => {
          testHelpers.validateConcoursePipeline(command, 'func.webhooks.github', 'push_docker_image', (pid) => {
            pipelineId = pipelineId || pid;
            didComparePipelineFiles = true;
            return cb(0, '');
          });
        }

        serverHelper(controller.githubWebhookHandler, (res) => {
          var body = JSON.parse(res.body);

          res.statusCode.should.equal(httpStatus.ACCEPTED);
          body.should.equal('Build Request Accepted');
          didComparePipelineFiles.should.be.true();
          mockedNext.called.should.be.false();

          // check we're not making excessive db calls
          mockedRequest.db.models.project.get.calledOnce.should.be.true();
          mockedProject.getNotificationTargets.calledOnce.should.be.true();
          mockedProject.getPipelineTasks.calledOnce.should.be.true();
          mockedProject.getApplicationImage.calledOnce.should.be.true();
          mockedProject.getDeploymentTarget.calledOnce.should.be.true();

          mockedExecution.save.calledOnce.should.be.true();
          mockedExecution.concourse_pipeline_id.should.equal(pipelineId);

          testHelpers.checkPipelineFile(
            mockedExecution.concourse_pipeline_id).should.be.false(
            `Should not exist *_${mockedExecution.concourse_pipeline_id}.yml`);

          done();
        });
      }).timeout(5000);

      it('should execute fly command with valid pipeline containing user docker image based on pull_request webhook event', (done) => {
        var pipelineId, didComparePipelineFiles = false,
          mockedApplicationImage = {
            image_repo: "n0dejsapi/sample-app",
            image_tag: "prod",
            credential: {
              username: "user-name",
              password: "password",
              email: "email@email.com"
            }
          },
          githubStatusNT = {
            id: 12,
            'type': "githubpullrequest",
            'token': "Github_token"
          };

        utils.database.connection.callsArgWith(0, null, function () {
          utils.database.connection.decryptValue = sinon.stub().returns("a_project_secret");
          return mockedRequest.db;
        }());
        mockedVCSProvider.client.updatePRStatus.callsArgWith(6, null);

        mockedRequest.body = require('./fixtures/func.webhooks.github/pull_request_payload.json');
        mockedRequest.headers = {
          'x-github-event': 'pull_request',
          'x-hub-signature': 'sha1=8902c88124e1efc15b573b6a831958fd8fa1fe83'
        };
        mockedProject = {
          id: 1,
          name: 'sample-app',
          type: 'nodejs',
          vcs: {
            api_url: "https://api.github.com",
            vcs_type: {
              vcs_type: "github"
            }
          },
          repo_owner: 'repo_owner',
          repo_name: 'repo_name',
          repo: {
            owner: 'owner',
            name: 'name',
            branch: 'branch'
          },
          repo_cloneUrl: 'https://github.com/flacnut/node-docker-hello',
          repo_branch: 'master',
          token: 'a_project_token',
          repo_secret: 'a_project_secret',
          getVcs: sinon.stub(),
          getDeploymentTarget: sinon.stub(),
          getNotificationTargets: sinon.stub(),
          getPipelineTasks: sinon.stub(),
          getApplicationImage: sinon.stub().callsArgWith(1, null, mockedApplicationImage),
          getBuildContainer: sinon.stub().callsArgWith(1, null, nodeJSBuildContainer)
        };
        mockedProject.getVcs.callsArgWith(1, null, githubVCSType);
        mockedRequest.db.models.project.returns(mockedProject);
        mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
        mockedRequest.db.models.build.create = (execution, cb) => {
          // we do this to copy the concourse_execution_id
          _.extend(mockedExecution, execution);
          return cb(null, mockedExecution);
        };

        mockedProject.getNotificationTargets.callsArgWith(0, null, [githubStatusNT]);
        mockedProject.getPipelineTasks.callsArgWith(0, null, []);
        mockedProject.getDeploymentTarget.callsArgWith(0, null, mockedTarget);
        mockedExecution.save.callsArgWith(0);

        // call this when calling shell.exec from the concourse client.
        require('shelljs').exec = (command, opts, cb) => {
          testHelpers.validateConcoursePipeline(command, 'func.webhooks.github', 'pull_request_docker_image', (pid) => {
            pipelineId = pipelineId || pid;
            didComparePipelineFiles = true;
            return cb(0, '');
          });
        }

        serverHelper(controller.githubWebhookHandler, (res) => {
          var body = JSON.parse(res.body);

          res.statusCode.should.equal(httpStatus.ACCEPTED);
          body.should.equal('Build Request Accepted');
          didComparePipelineFiles.should.be.true();
          mockedNext.called.should.be.false();

          // check we're not making excessive db calls
          mockedRequest.db.models.project.get.calledOnce.should.be.true();
          mockedProject.getNotificationTargets.calledOnce.should.be.true();
          mockedProject.getPipelineTasks.calledOnce.should.be.true();
          mockedProject.getDeploymentTarget.calledOnce.should.be.true();

          mockedExecution.save.calledOnce.should.be.true();
          mockedExecution.concourse_pipeline_id.should.equal(pipelineId);

          testHelpers.checkPipelineFile(
            mockedExecution.concourse_pipeline_id).should.be.false(
            `Should not exist *_${mockedExecution.concourse_pipeline_id}.yml`);

          mockedVCSProvider.client.updatePRStatus.calledOnce.should.be.true();
          mockedVCSProvider.client.updatePRStatus.calledWith(
            mockedProject.token,
            mockedProject.repo_owner,
            mockedProject.repo_name,
            '905b1afee58c6d3ff3cde0bce243a1f9cb9623ac',
            'pending',
            'Starting Build'
          ).should.be.true();

          done();
        });
      });
    });
  });

  function serverHelper(handler, onComplete) {
    server = http
      .createServer((req, res) => {
        res.status = (status) => {
          res.statusCode = status;
          return res;
        };

        res.send = (payload) => {
          return res.end(JSON.stringify(payload));
        };

        _.extend(req, mockedRequest);
        handler(req, res, mockedNext);
      })
      .listen(31415, (err) => {
        should.not.exist(err);

        request.post('http://localhost:31415', (err, res) => {
          should.not.exist(err);
          onComplete(res);
        });
      });
  }
});
