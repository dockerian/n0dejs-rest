var _ = require('lodash'),
  httpStatus = require('http-status-codes'),
  should = require('should'),
  sinon = require('sinon'),
  controller = require('../app/v2/containers/build_containers/controller.js'),
  utils = require('../utils');

describe('v2/containers/build_containers/controller', () => {
  var mockedRequest, mockedResponse, mockedNext, mockedbuildcontainer, mockedError;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    // Used in create.
    utils.database.connection.encryptValue = (value) => {
      return `encrypted_${value}`;
    };
  });

  beforeEach(() => {
    mockedRequest = {
      logger: utils.logger,
      params: {
        build_container_id: '1'
      },
      query: {},
      body: {},
      db: {
        models: {
          build_container: {
            get: sinon.stub(),
            create: sinon.stub(),
            find: sinon.stub(),
            all: sinon.stub()
          }
        }
      }
    };

    mockedResponse = {
      status: sinon.stub(),
      send: sinon.stub()
    };

    mockedbuildcontainer = {
      build_container_id: 1,
      build_container_image_id: 1,
      build_container_label: "label",
      save: sinon.stub(),
      remove: sinon.stub(),
      getProjects: sinon.stub()
    };

    mockedbuildcontainer2 = {
      build_container_id: 2,
      build_container_image_id: 2,
      save: sinon.stub(),
      remove: sinon.stub()
    };

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');
  });

  describe('addbuildcontainer', () => {
      it('should store a buildcontainer with valid data', (done) => {
        mockedResponse.status.returns(mockedResponse);
        mockedRequest.body.build_container_label = "build container label";
        mockedRequest.db.models.build_container.create.callsArgWith(1, null, mockedbuildcontainer);
        mockedRequest.body.build_container_image_id = 1;

        mockedResponse.send = (payload) => {
          var newbuildcontainerData;
          should.exist(payload);
          should.exist(payload.build_container_id);
          payload.build_container_image_id.should.equal(1);

          // What we tried to create
          mockedRequest.db.models.build_container.create.calledOnce.should.be.true();
          newbuildcontainerData = mockedRequest.db.models.build_container.create.getCall(0).args[0];
          newbuildcontainerData.build_container_label.should.equal("build container label");

          // What was the result
          mockedResponse.status.calledWith(httpStatus.CREATED).should.be.true();
          mockedNext.called.should.be.false();
          done();
        };

        controller.addBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return error if unable to create buildcontainer', (done) => {
        mockedResponse.status.returns(mockedResponse);
        mockedRequest.db.models.build_container.create.callsArgWith(1, mockedError, null);

        mockedNext = (err) => {
          should.exist(err);
          err.should.be.an.instanceOf(Error);
          err.message.should.equal(mockedError.message);
          should.not.exist(err.status);
          mockedRequest.db.models.build_container.create.calledOnce.should.be.true();
          mockedResponse.send.called.should.be.false();
          mockedResponse.status.called.should.be.false();
          done();
        };

        controller.addBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return generic error if ORM behaves unexpectedly', (done) => {
        mockedResponse.status.returns(mockedResponse);
        mockedRequest.db.models.build_container.create.callsArgWith(1, null, null);

        mockedNext = (err) => {
          should.exist(err);
          err.should.be.an.instanceOf(Error);
          err.message.should.equal('ORM returned no error, and no build container');
          should.not.exist(err.status);
          mockedRequest.db.models.build_container.create.calledOnce.should.be.true();
          mockedResponse.send.called.should.be.false();
          mockedResponse.status.called.should.be.false();
          done();
        };

        controller.addBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });
    }),

    describe('getBuildContainers', () => {
      it('should list build containers', (done) => {
        mockedRequest.db.models.build_container.all.callsArgWith(0, null, [mockedbuildcontainer, mockedbuildcontainer2]);
        mockedResponse.send = (buildcontainers) => {
          mockedNext.called.should.be.false();
          buildcontainers.length.should.equal(2);
          buildcontainers[0].build_container_id.should.equal(1);
          done();
        };

        controller.getBuildContainers(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return an error when finding build containers fails', (done) => {
        mockedRequest.db.models.build_container.all.callsArgWith(0, mockedError, null);
        mockedNext = (err) => {
          err.message.should.equal(mockedError.message);
          mockedResponse.send.called.should.be.false();
          mockedResponse.status.called.should.be.false();
          done();
        };

        controller.getBuildContainers(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return an error when getBuildContainer fails on ORM error', (done) => {
        mockedRequest.params.container_id = 1;
        mockedRequest.db.models.build_container.all.callsArgWith(0, null, null);
        mockedNext = (err) => {
          var message = `ORM returned no error, and no build containers`;
          err.message.should.equal(message);
          mockedRequest.db.models.build_container.all.calledWith(1);
          mockedResponse.status.called.should.be.false();
          mockedResponse.send.called.should.be.false();
          done();
        };

        controller.getBuildContainers(mockedRequest, mockedResponse, mockedNext);
      });
    }),

    describe('getBuildContainer', () => {
      it('should get a build container', (done) => {
        mockedRequest.db.models.build_container.get.callsArgWith(1, null, mockedbuildcontainer);
        mockedResponse.send = (payload) => {
          payload.should.be.equal(mockedbuildcontainer);
          mockedRequest.db.models.build_container.get.calledWith(1);
          mockedResponse.status.called.should.be.false();
          mockedNext.called.should.be.false();
          done();
        };

        controller.getBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return an error when getBuildContainer fails on ORM error', (done) => {
        mockedRequest.params.container_id = 1;
        mockedRequest.db.models.build_container.get.callsArgWith(1, null, null);
        mockedNext = (err) => {
          var message = `ORM returned no error, and no build container:1`;
          err.message.should.equal(message);
          mockedRequest.db.models.build_container.get.calledWith(1);
          mockedResponse.status.called.should.be.false();
          mockedResponse.send.called.should.be.false();
          done();
        };

        controller.getBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });
    }),


    describe('removeBuildContainer', () => {
      it('should successfully delete a build container', (done) => {
        mockedbuildcontainer.getProjects.callsArgWith(0, null, null);
        mockedRequest.db.models.build_container.get.callsArgWith(1, null, mockedbuildcontainer);
        mockedbuildcontainer.remove.callsArgWith(0, null);
        mockedResponse.status.returns(mockedResponse);

        mockedResponse.send = () => {
          mockedResponse.status.calledOnce.should.be.true();
          mockedResponse.status.calledWith(httpStatus.NO_CONTENT);
          mockedNext.called.should.be.false();
          done();
        };
        controller.removeBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return an error when a build container cannot be found', (done) => {
        mockedRequest.params.container_id = 1;
        mockedRequest.db.models.build_container.get.callsArgWith(1, null, null);
        mockedNext = (err) => {
          mockedResponse.status.calledOnce.should.be.false();
          mockedResponse.send.calledOnce.should.be.false();
          err.message.should.equal(`ORM returned no error, and no build container:1`)
          done();
        };
        controller.removeBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return an error when a build container failed to remove', (done) => {
        mockedbuildcontainer.getProjects.callsArgWith(0, null, null);
        mockedRequest.db.models.build_container.get.callsArgWith(1, null, mockedbuildcontainer);
        mockedbuildcontainer.remove.callsArgWith(0, mockedError);

        mockedNext = (err) => {
          mockedResponse.status.calledOnce.should.be.false();
          mockedResponse.send.calledOnce.should.be.false();
          err.message.should.equal(mockedError.message);
          done();
        };
        controller.removeBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return an error when getting projects fails', (done) => {
        mockedRequest.db.models.build_container.get.callsArgWith(1, null, mockedbuildcontainer);
        mockedbuildcontainer.getProjects.callsArgWith(0, mockedError);

        mockedNext = (err) => {
          err.message.should.equal(mockedError.message);
          mockedResponse.status.called.should.be.false();
          mockedResponse.send.called.should.be.false();
          done();
        };

        controller.removeBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return an error when a build container is currently used by project(s)', (done) => {
        var mockedProjects = [{
          project_id: 1
            }];
        mockedRequest.db.models.build_container.get.callsArgWith(1, null, mockedbuildcontainer);
        mockedbuildcontainer.getProjects.callsArgWith(0, null, mockedProjects);

        mockedNext = (err) => {
          err.message.should.equal(`Cannot delete. ` +
            `The build container is still in use by ` +
            `${mockedProjects.length} project(s).`);
          mockedResponse.status.called.should.be.false();
          mockedResponse.send.called.should.be.false();
          done();
        };

        controller.removeBuildContainer(mockedRequest, mockedResponse, mockedNext);
      });
    });

  describe('updateBuildContainer', () => {
    it('should update an existing buildcontainer with a new buildcontainer', (done) => {
      mockedRequest.db.models.build_container.get.callsArgWith(1, null, mockedbuildcontainer);
      mockedRequest.body.build_container_label = 'new label';
      mockedbuildcontainer.save.callsArgWith(0, null);

      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.build_container_id);
        payload.build_container_id.should.equal(1);
        payload.build_container_label.should.equal('new label');

        mockedRequest.db.models.build_container.get.calledOnce.should.be.true();
        mockedNext.called.should.be.false();
        mockedbuildcontainer.save.calledOnce.should.be.true();
        done();
      };

      controller.updateBuildContainer(mockedRequest, mockedResponse, mockedNext);
    });

    it('Should return next error when there is no build container', (done) => {
      mockedRequest.params.container_id = 1;
      mockedRequest.db.models.build_container.get.callsArgWith(1, null, null);
      mockedRequest.body.build_container_label = 'new label';
      mockedbuildcontainer.save.callsArgWith(0, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error, and no build container:1');
        should.not.exist(err.status);
        mockedRequest.db.models.build_container.get.calledOnce.should.be.true();
        mockedbuildcontainer.save.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateBuildContainer(mockedRequest, mockedResponse, mockedNext);
    });

    it('Should return buildcontainer save error when buildcontainer save fails', (done) => {
      mockedRequest.db.models.build_container.get.callsArgWith(1, null, mockedbuildcontainer);
      mockedRequest.body.build_container_label = 'new label';
      mockedbuildcontainer.save.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);
        should.not.exist(err.status);
        mockedRequest.db.models.build_container.get.calledOnce.should.be.true();
        mockedbuildcontainer.save.calledOnce.should.be.true();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateBuildContainer(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
