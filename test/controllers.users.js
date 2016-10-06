var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  controller = require('../app/v2/users/controller.js');

describe('v2/users/controller', () => {
  var mockedFindAll = sinon.stub();
  var mockedRequest, mockedResponse, mockedNext, mockedUser, mockedError;
  var loggerLevel;

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
        user_id: '1'
      },
      query: {},
      body: {},
      db: {
        models: {
          user: {
            create: sinon.stub(),
            find: sinon.stub(),
            get: sinon.stub()
          }
        }
      }
    };

    mockedResponse = {
      status: sinon.stub(),
      send: sinon.stub()
    };

    mockedUser = {
      user_id: 1,
      remove: sinon.stub(),
      save: sinon.stub()
    };

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');
  });

  describe('getUser', () => {
    it('should get a user', (done) => {
      mockedRequest.user = {
        user_id: mockedUser.user_id
      };
      mockedRequest.db.models.user.get.callsArgWith(1, null, mockedUser);

      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.user_id);
        payload.user_id.should.equal(mockedUser.user_id);
        mockedNext.called.should.be.false();
        done();
      };

      controller.getUser(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return a 404 error for non-existent user', (done) => {
      mockedRequest.db.models.user.get.callsArgWith(1, mockedError, mockedUser);
      mockedError.status = 404;

      mockedRequest.user = {
        user_id: mockedUser.user_id
      };
      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.status.should.equal(404);
        err.message.should.equal(mockedError.message);

        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getUser(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an unclassified error if ORM behaves unexpectedly', (done) => {
      mockedRequest.db.models.user.get.callsArgWith(1, null, null);

      mockedRequest.user = {
        user_id: mockedUser.user_id
      };
      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error, and no user:1');
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getUser(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getUserByUaaId', () => {
    var mockedFindResult = {
      limit: sinon.stub().returns({
        all: mockedFindAll
      })
    };

    it('should get a user by uaa id', (done) => {
      mockedRequest.params.uaa_id = 'b7fe1fda-31b0-11e6-a588-6c4008a93cee';
      mockedRequest.db.models.user.find.returns(mockedFindResult);
      mockedFindAll.callsArgWith(0, null, [mockedUser]);

      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.user_id);
        payload.user_id.should.equal(mockedUser.user_id);
        mockedNext.called.should.be.false();
        done();
      };

      controller.getUserByUaaId(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return a 404 error for non-existent user', (done) => {
      mockedRequest.params.uaa_id = 'b7fe1fda-31b0-11e6-a588-6c4008a93cee';
      mockedRequest.db.models.user.find.returns(mockedFindResult);
      mockedFindAll.callsArgWith(0, null, []);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.status.should.equal(404);
        err.message.should.equal(`Cannot find user with uaa id ${mockedRequest.params.uaa_id}.`);

        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getUserByUaaId(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an unclassified error if ORM behaves unexpectedly', (done) => {
      mockedRequest.db.models.user.find.returns(mockedFindResult);
      mockedFindAll.callsArgWith(0, null, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('ORM returned no error and an unexpected result.');
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getUserByUaaId(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
