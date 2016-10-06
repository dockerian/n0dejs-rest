var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  controller = require('../app/v2/vcs/controller.js');

describe('v2/vcs/controller', () => {
  var mockedRequest, mockedResponse, mockedNext, mockedVcs, mockedVcs2,
    mockedVcsType1, mockedVcsType2, mockedError, mockedDB;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    mockedDB = {}
    mockedDB.models = {
      vcs: {
        exists: sinon.stub().callsArgWith(1, null, false)
      }
    };

    utils.database.connection = sinon.stub().callsArgWith(0, null, mockedDB)

    utils.database.connection.encryptValue = (value) => {
      return `encrypted_${value}`;
    };
  });

  beforeEach(() => {
    mockedDB.models.vcs.exists.callsArgWith(1, null, false);
    mockedRequest = {
      logger: utils.logger,
      params: {
        vcs_id: '1'
      },
      query: {
        vcs_id: 1
      },
      body: {
        label: 'my vcs instance',
        browse_url: 'https://vcs.org',
        api_url: 'https://api.vcs.org/v2'
      },
      db: {
        models: {
          vcs: {
            get: sinon.stub(),
            create: sinon.stub(),
            find: sinon.stub(),
            all: sinon.stub()
          },
          project: {
            count: sinon.stub()
          },
          vcs_type: {
            all: sinon.stub()
          }
        }
      }
    };

    mockedResponse = {
      status: sinon.stub(),
      send: sinon.stub()
    };

    mockedVcs = {
      vcs_id: 1,
      skip_ssl_validation: false,
      save: sinon.stub(),
      remove: sinon.stub()
    };

    mockedVcs2 = {
      vcs_id: 2,
      save: sinon.stub(),
      remove: sinon.stub()
    };

    mockedVcsType1 = {
      vcs_type_id: 1,
      all: sinon.stub()
    };

    mockedVcsType2 = {
      vcs_type_id: 2,
      all: sinon.stub()
    };

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');
  });

  describe('addVcs', () => {
    it('should store a vcs with valid data', (done) => {
      mockedResponse.status.returns(mockedResponse);
      mockedRequest.body.vcs_type = "GITHUB";
      mockedRequest.db.models.vcs.create.callsArgWith(1, null, mockedVcs);

      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.vcs_id);
        payload.vcs_id.should.equal(1);
        payload.skip_ssl_validation.should.be.false();

        // What we tried to create
        mockedRequest.db.models.vcs.create.calledOnce.should.be.true();
        mockedRequest.db.models.vcs.create.getCall(0).args[0].vcs_type_id.should.equal(1);

        // What was the result
        mockedResponse.status.calledWith(httpStatus.CREATED).should.be.true();
        mockedNext.called.should.be.false();
        done();
      };

      controller.addVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail vcs creation with duplicate values', (done) => {
      mockedResponse.status.returns(mockedResponse);
      mockedRequest.body.vcs_type = "GITHUB";
      mockedRequest.db.models.vcs.create.callsArgWith(1, null, mockedVcs);
      mockedDB.models.vcs.exists.callsArgWith(1, null, true);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: api_url.');
        should.exist(err.status);
        err.status.should.equal(400);
        mockedRequest.db.models.vcs.create.calledOnce.should.be.false();
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.addVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return a bad request if we pass invalid vcs type', (done) => {
      mockedRequest.body.vcs_type = "invalid";
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: Invalid vcs type provided.');
        should.exist(err.status);
        err.status.should.equal(400);

        mockedRequest.db.models.vcs.create.calledOnce.should.be.false();
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.addVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return a bad request if we pass invalid input values', (done) => {
      mockedRequest.body.label = null;
      mockedRequest.body.vcs_type = "GITHUB";
      mockedResponse.status.returns(mockedResponse);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: label.');
        should.exist(err.status);
        err.status.should.equal(400);

        mockedRequest.db.models.vcs.create.calledOnce.should.be.false();
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.addVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return error if unable to create vcs', (done) => {
      mockedRequest.body.vcs_type = "GITHUB";
      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.vcs.create.callsArgWith(1, mockedError, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);
        should.not.exist(err.status);
        mockedRequest.db.models.vcs.create.calledOnce.should.be.true();
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.addVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return generic error if ORM behaves unexpectedly', (done) => {
      mockedRequest.body.vcs_type = "GITHUB";
      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.models.vcs.create.callsArgWith(1, null, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error, and no vcs');
        should.not.exist(err.status);
        mockedRequest.db.models.vcs.create.calledOnce.should.be.true();
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.addVcs(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('Get vcses', () => {
    it('should get vcses', (done) => {
      mockedRequest.db.models.vcs.all.callsArgWith(0, null, [mockedVcs, mockedVcs2]);

      mockedResponse.send = (vcses) => {
        mockedNext.called.should.be.false();
        vcses.length.should.equal(2);
        vcses[0].vcs_id.should.equal(1);
        should.not.exist(vcses[0].vcs_type_id, "Should not return vcs_type_id in list");
        done();
      };

      controller.getVcses(mockedRequest, mockedResponse, mockedNext);
    });


    it('should return an error when getting vcses fails', (done) => {
      mockedRequest.db.models.vcs.all.callsArgWith(0, null, null);
      mockedNext = (err) => {
        err.message.should.equal("ORM returned no error, and no vcsses");
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.getVcses(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when failed to get vcses', (done) => {
      mockedRequest.db.models.vcs.all.callsArgWith(0, mockedError, null);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.getVcses(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('remove vcs', () => {
    it('should remove a vcs', (done) => {
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, mockedVcs);
      mockedRequest.db.models.project.count.callsArgWith(1, null, 0);
      mockedVcs.remove.callsArgWith(0, null);
      mockedResponse.status.returns(mockedResponse);

      mockedResponse.send = () => {
        mockedNext.called.should.be.false();
        mockedResponse.status.calledWith(httpStatus.NO_CONTENT).should.be.true();
        done();
      };

      controller.removeVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a vcs doesn\'t exist', (done) => {
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, null);
      mockedRequest.db.models.project.count.callsArgWith(1, null, 0);
      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no vcs:${mockedRequest.params.vcs_id}`);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.removeVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getting projects\' count fails', (done) => {
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, mockedVcs);
      mockedRequest.db.models.project.count.callsArgWith(1, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.removeVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a vcs is on project(s)', (done) => {
      var mockedProjects = [{
        id: 1
      }];
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, mockedVcs);
      mockedRequest.db.models.project.count.callsArgWith(1, null, 1);
      mockedNext = (err) => {
        err.message.should.equal(`ORM behaved unexpectedly and didn\'t return an error. Information: Cannot delete. ` +
          `The vcs is still in use by ` +
          `${mockedProjects.length} project(s)..`);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.removeVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when removing a vcs fails', (done) => {
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, mockedVcs);
      mockedRequest.db.models.project.count.callsArgWith(1, null, 0);
      mockedVcs.remove.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.removeVcs(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getVcs', () => {
    it('should get a vcs', (done) => {
      mockedRequest.params.vcs_id = 1;
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, mockedVcs);
      mockedResponse.send = (payload) => {
        payload.skip_ssl_validation.should.equal(false);
        mockedRequest.db.models.vcs.get.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        mockedRequest.db.models.vcs.get.getCall(0).args[0].should.equal(1);
        done();
      };

      controller.getVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getVcs fails on ORM error', (done) => {
      mockedRequest.params.vcs_id = 1;
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, null);
      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no vcs:1`);
        mockedRequest.db.models.vcs.get.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getVcs(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getVcsAuth', () => {
    it('should get the auth credentials for a vcs', (done) => {
      var mockCredential = {
        credential_type: {
          credential_type: "USERNAME_PASSWORD"
        },
        credential_id: 1,
        created: "yesterday",
        modified: "today",
        label: "Credential",
        owner_id: 12,
        credential_key: "CLIENT_ID",
        credential_value: "CLIENT_SECRET",
        credential_extra: "EXTRA"
      };
      mockedRequest.params.vcs_id = 1;
      mockedVcs.credential = mockCredential;
      mockedRequest.db.models.vcs.get.callsArgWith(2, null, mockedVcs);
      mockedResponse.send = (payload) => {
        mockCredential.credential_type = "USERNAME_PASSWORD";
        var serialized = payload.serialize();
        serialized.credential_type.should.be.equal(mockCredential.credential_type);
        serialized.credential_key.should.be.equal(mockCredential.credential_key);
        serialized.credential_value.should.be.equal(mockCredential.credential_value);
        serialized.credential_extra.should.be.equal(mockCredential.credential_extra);
        mockedRequest.db.models.vcs.get.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        mockedRequest.db.models.vcs.get.getCall(0).args[0].should.equal(1);
        done();
      };

      controller.getVcsAuth(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getVcs fails on ORM error', (done) => {
      mockedRequest.params.vcs_id = 1;
      mockedRequest.db.models.vcs.get.callsArgWith(2, null, null);
      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no vcs:1`);
        mockedRequest.db.models.vcs.get.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getVcsAuth(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when vcs has no Auth', (done) => {
      delete mockedVcs.credential;
      mockedRequest.params.vcs_id = 1;
      mockedRequest.db.models.vcs.get.callsArgWith(2, null, mockedVcs);
      mockedNext = (err) => {
        err.message.should.equal(`no credentials found on vcs instance`);
        mockedRequest.db.models.vcs.get.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getVcsAuth(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('updateVcs', () => {
    it('should update an existing vcs with a new vcs_type', (done) => {
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, mockedVcs);
      mockedRequest.body.vcs_type = "GITHUB_ENTERPRISE";
      mockedVcs.save.callsArgWith(0, null);

      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.vcs_id);
        payload.vcs_id.should.equal(1);

        mockedRequest.db.models.vcs.get.calledOnce.should.be.true();
        mockedNext.called.should.be.false();
        mockedVcs.save.calledOnce.should.be.true();
        done();
      };

      controller.updateVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail vcs update with duplicate values', (done) => {
      mockedResponse.status.returns(mockedResponse);
      mockedRequest.body.vcs_type = "GITHUB";
      mockedRequest.db.models.vcs.create.callsArgWith(1, null, mockedVcs);
      mockedDB.models.vcs.exists.callsArgWith(1, null, true);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('Bad Request, the following properties were missing or invalid: api_url.');
        should.exist(err.status);
        err.status.should.equal(400);

        mockedDB.models.vcs.exists.calledWith({
          api_url: 'https://api.vcs.org/v2',
          vcs_id: {
            val: '1'
          }
        }).should.be.true();
        mockedRequest.db.models.vcs.create.calledOnce.should.be.false();
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.updateVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('Should return next error when there is no vcs', (done) => {
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, null);
      mockedRequest.body.vcs_type = "GITHUB_ENTERPRISE";
      mockedVcs.save.callsArgWith(0, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error, and no vcs:1');
        should.not.exist(err.status);
        mockedRequest.db.models.vcs.get.calledOnce.should.be.true();
        mockedVcs.save.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateVcs(mockedRequest, mockedResponse, mockedNext);
    });

    it('Should return vcs save error when vcs save fails', (done) => {
      mockedRequest.db.models.vcs.get.callsArgWith(1, null, mockedVcs);
      mockedRequest.body.vcs_type = "GITHUB_ENTERPRISE";
      mockedVcs.save.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);
        should.not.exist(err.status);
        mockedRequest.db.models.vcs.get.calledOnce.should.be.true();
        mockedVcs.save.calledOnce.should.be.true();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateVcs(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('listVcsTypes', () => {
    it('should successfully get all vcs_types', (done) => {
      mockedRequest.db.models.vcs_type.all.callsArgWith(0, null, [mockedVcsType1, mockedVcsType2]);
      mockedResponse.send = (vcs_types) => {
        vcs_types.length.should.equal(2);
        vcs_types[0].vcs_type_id.should.equal(1);
        mockedNext.called.should.be.false();
        done();
      };

      controller.listVcsTypes(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when listVcsTypes fails', (done) => {
      mockedRequest.db.models.vcs_type.all.callsArgWith(0, mockedError, null);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.listVcsTypes(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when listVcsTypes fails on ORM error', (done) => {
      mockedRequest.db.models.vcs_type.all.callsArgWith(0, null, null);
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no vcs_types');
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.listVcsTypes(mockedRequest, mockedResponse, mockedNext);
    });
  });

});
