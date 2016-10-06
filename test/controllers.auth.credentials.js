var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  controller = require('../app/v2/auth/credentials/controller.js');

describe('v2/auth/credentials/controller', () => {
  var mockedRequest, mockedResponse, mockedNext, mockedCredential, mockedError;

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
        credential_id: '1'
      },
      query: {
        user_id: 1
      },
      body: {},
      db: {
        models: {
          credential: {
            get: sinon.stub(),
            create: sinon.stub(),
            find: sinon.stub()
          }
        }
      }
    };

    mockedRequest.user = {
      user_id: 1
    };

    mockedResponse = {
      status: sinon.stub(),
      send: sinon.stub()
    };

    mockedCredential = {
      credential_id: 1,
      save: sinon.stub(),
      remove: sinon.stub(),
      getProjects: sinon.stub(),
      getVcses: sinon.stub()
    };

    mockedCredential2 = {
      credential_id: 2,
      save: sinon.stub(),
      remove: sinon.stub(),
      getProjects: sinon.stub(),
      getVcses: sinon.stub()
    };

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');
  });

  describe('storeCredential', () => {
      it('should store a credential with valid data', (done) => {
        mockedResponse.status.returns(mockedResponse);
        mockedRequest.body.credential_type = 'USERNAME_PASSWORD';
        mockedRequest.body.credential_key = "Username";
        mockedRequest.body.credential_value = "Password";
        mockedRequest.body.credential_extra = "extra_field";
        mockedRequest.db.models.credential.create.callsArgWith(1, null, mockedCredential);
        mockedRequest.body.owner_id = 1;
        mockedResponse.send = (payload) => {
          var newCredentialData;
          should.exist(payload);
          should.exist(payload.credential_id);
          payload.credential_id.should.equal(1);

          // What we tried to create
          mockedRequest.db.models.credential.create.calledOnce.should.be.true();
          newCredentialData = mockedRequest.db.models.credential.create.getCall(0).args[0];
          newCredentialData.owner_id.should.equal(1);

          // What was the result
          mockedResponse.status.calledWith(httpStatus.CREATED).should.be.true();
          mockedNext.called.should.be.false();
          done();
        };

        controller.storeCredential(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return an error if we pass invalid credential type', (done) => {
        mockedRequest.body.credential_type = 'invalid';
        mockedResponse.status.returns(mockedResponse);
        mockedRequest.body.owner_id = 1;

        mockedNext = (err) => {
          should.exist(err);
          err.should.be.an.instanceOf(Error);
          err.message.should.equal('Bad Request, the following properties were missing or invalid: Invalid credential type.');
          should.exist(err.status);
          err.status.should.equal(400);

          mockedRequest.db.models.credential.create.calledOnce.should.be.false();
          mockedResponse.send.called.should.be.false();
          mockedResponse.status.called.should.be.false();
          done();
        };

        controller.storeCredential(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return error if unable to create credential', (done) => {
        mockedRequest.body.credential_type = 'USERNAME_PASSWORD';
        mockedResponse.status.returns(mockedResponse);
        mockedRequest.db.models.credential.create.callsArgWith(1, mockedError, null);
        mockedRequest.body.owner_id = 1;

        mockedNext = (err) => {
          should.exist(err);
          err.should.be.an.instanceOf(Error);
          err.message.should.equal(mockedError.message);
          should.not.exist(err.status);
          mockedRequest.db.models.credential.create.calledOnce.should.be.true();
          mockedResponse.send.called.should.be.false();
          mockedResponse.status.called.should.be.false();
          done();
        };

        controller.storeCredential(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return generic error if ORM behaves unexpectedly', (done) => {
        mockedRequest.body.credential_type = 'USERNAME_PASSWORD';
        mockedResponse.status.returns(mockedResponse);
        mockedRequest.db.models.credential.create.callsArgWith(1, null, null);
        mockedRequest.body.owner_id = 1;

        mockedNext = (err) => {
          should.exist(err);
          err.should.be.an.instanceOf(Error);
          err.message.should.equal('ORM returned no error, and no credential');
          should.not.exist(err.status);
          mockedRequest.db.models.credential.create.calledOnce.should.be.true();
          mockedResponse.send.called.should.be.false();
          mockedResponse.status.called.should.be.false();
          done();
        };

        controller.storeCredential(mockedRequest, mockedResponse, mockedNext);
      });
    }),

    describe('list credentials', () => {
      it('should list credentials', (done) => {
        mockedRequest.db.models.credential.find.callsArgWith(1, null, [mockedCredential, mockedCredential2]);

        mockedResponse.send = (credentials) => {
          mockedNext.called.should.be.false();
          credentials.length.should.equal(2);
          credentials[0].credential_id.should.equal(1);
          should.not.exist(credentials[0].credential_value, 'Should not return credential value in list');
          done();
        };

        controller.listCredentials(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return a bad request if there is no user id', (done) => {
        mockedRequest.user.user_id = null;

        mockedNext = (err) => {
          err.message.should.equal('userId filter is required but not provided in query.');
          err.status.should.equal(httpStatus.BAD_REQUEST);
          mockedResponse.send.called.should.be.false();
          mockedResponse.status.called.should.be.false();
          done();
        };

        controller.listCredentials(mockedRequest, mockedResponse, mockedNext);
      });

      it('should return an error when finding credentials fails', (done) => {
        mockedRequest.db.models.credential.find.callsArgWith(1, mockedError, null);
        mockedNext = (err) => {
          err.message.should.equal(mockedError.message);
          mockedResponse.send.called.should.be.false();
          mockedResponse.status.called.should.be.false();
          done();
        };

        controller.listCredentials(mockedRequest, mockedResponse, mockedNext);
      });
    });

  describe('remove credential', () => {
    it('should remove a credential', (done) => {
      mockedRequest.db.models.credential.get.callsArgWith(1, null, mockedCredential);
      mockedCredential.getProjects.callsArgWith(0, null, null);
      mockedCredential.getVcses.callsArgWith(0, null, null);
      mockedCredential.remove.callsArgWith(0, null);
      mockedResponse.status.returns(mockedResponse);

      mockedResponse.send = () => {
        mockedNext.called.should.be.false();
        mockedResponse.status.calledWith(httpStatus.NO_CONTENT).should.be.true();
        done();
      };

      controller.forgetCredential(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a credential doesn\'t exist', (done) => {
      mockedRequest.db.models.credential.get.callsArgWith(1, null, null);

      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no credential:${mockedRequest.params.credential_id}`);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.forgetCredential(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getting projects fails', (done) => {
      mockedRequest.db.models.credential.get.callsArgWith(1, null, mockedCredential);
      mockedCredential.getProjects.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.forgetCredential(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getting vcs(es) fails', (done) => {
      mockedRequest.db.models.credential.get.callsArgWith(1, null, mockedCredential);
      mockedCredential.getVcses.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.forgetCredential(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a credential is on project(s)', (done) => {
      var mockedProjects = [{
        id: 1
        }];
      mockedRequest.db.models.credential.get.callsArgWith(1, null, mockedCredential);
      mockedCredential.getProjects.callsArgWith(0, null, mockedProjects);

      mockedNext = (err) => {
        err.message.should.equal(`ORM behaved unexpectedly and didn\'t return an error. Information: Cannot delete. ` +
          `The credential is still in use by ` +
          `${mockedProjects.length} project(s)..`);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.forgetCredential(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when a credential is on vcs(es)', (done) => {
      var mockedVcss = [{
        id: 1
        }];
      mockedRequest.db.models.credential.get.callsArgWith(1, null, mockedCredential);
      mockedCredential.getVcses.callsArgWith(0, null, mockedVcss);

      mockedNext = (err) => {
        err.message.should.equal(`ORM behaved unexpectedly and didn\'t return an error. Information: Cannot delete. ` +
          `The credential is still in use by ` +
          `${mockedVcss.length} vcs(es)..`);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.forgetCredential(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when removing a credential fails', (done) => {
      mockedRequest.db.models.credential.get.callsArgWith(1, null, mockedCredential);
      mockedCredential.getProjects.callsArgWith(0, null, null);
      mockedCredential.getVcses.callsArgWith(0, null, null);
      mockedCredential.remove.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.forgetCredential(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('updateCredential', () => {
    it('should update an existing credential with a new credential_value', (done) => {
      mockedRequest.db.models.credential.get.callsArgWith(1, null, mockedCredential);
      mockedRequest.body.credential_value = 'new password';
      mockedCredential.save.callsArgWith(0, null);

      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.credential_id);
        payload.credential_id.should.equal(1);

        mockedRequest.db.models.credential.get.calledOnce.should.be.true();
        mockedNext.called.should.be.false();
        mockedCredential.save.calledOnce.should.be.true();
        done();
      };

      controller.updateCredential(mockedRequest, mockedResponse, mockedNext);
    });

    it('should update an existing credential and keep old values', (done) => {
      mockedRequest.db.models.credential.get.callsArgWith(1, null, mockedCredential);

      _.extend(mockedCredential, {
        credential_type: 'USERNAME_PASSWORD',
        credential_key: 'Username',
        credential_value: 'Password',
        credential_extra: 'extra_field',
        label: "IMMACREDENTIAL",
        owner_id: 1
      });
      mockedRequest.body.label = null;
      mockedRequest.body.credential_key = null;
      mockedRequest.body.credential_value = null;
      mockedRequest.body.credential_extra = null;
      mockedCredential.save.callsArgWith(0, null);

      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.credential_id);
        payload.credential_id.should.equal(1);
        mockedCredential.label.should.be.equal("IMMACREDENTIAL");
        mockedCredential.credential_key.should.be.equal("Username");
        mockedCredential.credential_value.should.be.equal("Password");
        mockedCredential.credential_extra.should.be.equal("extra_field");
        mockedRequest.db.models.credential.get.calledOnce.should.be.true();
        mockedNext.called.should.be.false();
        mockedCredential.save.calledOnce.should.be.true();
        done();
      };

      controller.updateCredential(mockedRequest, mockedResponse, mockedNext);
    });

    it('Should return next error when there is no credential', (done) => {
      mockedRequest.db.models.credential.get.callsArgWith(1, null, null);
      mockedRequest.body.credential_value = 'new password';
      mockedCredential.save.callsArgWith(0, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error, and no credential:1');
        should.not.exist(err.status);
        mockedRequest.db.models.credential.get.calledOnce.should.be.true();
        mockedCredential.save.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateCredential(mockedRequest, mockedResponse, mockedNext);
    });

    it('Should return credential save error when credential save fails', (done) => {
      mockedRequest.db.models.credential.get.callsArgWith(1, null, mockedCredential);
      mockedRequest.body.secret = '123';
      mockedCredential.save.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal(mockedError.message);
        should.not.exist(err.status);
        mockedRequest.db.models.credential.get.calledOnce.should.be.true();
        mockedCredential.save.calledOnce.should.be.true();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.updateCredential(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
