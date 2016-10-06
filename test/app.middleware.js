var _ = require('lodash'),
  orm = require('orm'),
  should = require('should'),
  sinon = require('sinon'),
  uuid = require('uuid'),
  rewire = require('rewire'),
  middleware = rewire('../app/middleware.js'),
  utils = require('../utils');

describe('/middleware', () => {
  var mockedDb, mockedEntries, mockedLogger;
  var mockedError, mockedNext, mockedRequest, mockedResponse;
  var mockedUuid = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  var savedDbConnection, savedShim, savedUuidV4;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    savedDbConnection = utils.database.connection;
    utils.database.connection = sinon.stub();

    savedShim = utils.logger.shim;
    utils.logger.shim = (logger, id) => {
      logger.id = id;
      return logger;
    }

    savedUuidV4 = uuid.v4;
    uuid.v4 = () => {
      return mockedUuid;
    };
  });

  after(() => {
    utils.database.connection = savedDbConnection;
    utils.logger.shim = savedShim;
    uuid.v4 = savedUuidV4;
  });

  beforeEach(() => {
    mockedDb = {
      db: 'database'
    };
    mockedEntries = ['a', 'b', 'c'];
    mockedError = new Error('Mocked Error');
    mockedNext = sinon.stub();

    mockedLogger = {
      error: sinon.stub(),
      getEntriesForId: sinon.stub(),
      shim: sinon.stub()
    };

    mockedRequest = {
      id: 123456,
      headersSent: false,
      logger: mockedLogger
    };

    mockedResponse = {
      end: sinon.stub(),
      header: sinon.stub(),
      json: sinon.stub(),
      send: sinon.stub(),
      status: sinon.stub()
    };
  });

  describe('errorHandler', () => {
    var responseData;

    beforeEach(() => {
      responseData = {
        message: mockedError.message,
        details: mockedError.details || '',
        status: mockedError.status,
        api_version: 2,
        log: mockedEntries
      };

    });

    it('should handle headersSent', (done) => {
      mockedResponse.headersSent = true;
      mockedResponse.end = (data) => {
        var msg = 'Next was called, but the response headers have been sent.';
        mockedLogger.error.calledWith(msg, mockedError);
        done();
      };

      middleware.errorHandler(mockedError, mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle general error, status is a string', (done) => {
      mockedRequest.logger.getEntriesForId.callsArgWith(1, null, mockedEntries);
      mockedError.status = 'helloworld';
      mockedNext = (err) => {
        var msg = 'Next was called with an error.';
        should.not.exist(err);
        should.exist(mockedError.status);
        mockedError.status.should.be.equal(500);
        mockedResponse.json.calledWith(responseData);
        mockedResponse.status.calledWith(mockedError.status);
        mockedLogger.error.calledWith(msg, mockedError);
        done();
      };

      middleware.errorHandler(mockedError, mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle general error, status is 0', (done) => {
      mockedRequest.logger.getEntriesForId.callsArgWith(1, null, mockedEntries);
      mockedError.status = 0;
      mockedNext = (err) => {
        var msg = 'Next was called with an error.';
        should.not.exist(err);
        should.exist(mockedError.status);
        mockedError.status.should.be.equal(500);
        mockedResponse.json.calledWith(responseData);
        mockedResponse.status.calledWith(mockedError.status);
        mockedLogger.error.calledWith(msg, mockedError);
        done();
      };

      middleware.errorHandler(mockedError, mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle general error, status is not a valid status code', (done) => {
      mockedRequest.logger.getEntriesForId.callsArgWith(1, null, mockedEntries);
      mockedError.status = 1999;
      mockedNext = (err) => {
        var msg = 'Next was called with an error.';
        should.not.exist(err);
        should.exist(mockedError.status);
        mockedError.status.should.be.equal(500);
        mockedResponse.json.calledWith(responseData);
        mockedResponse.status.calledWith(mockedError.status);
        mockedLogger.error.calledWith(msg, mockedError);
        done();
      };

      middleware.errorHandler(mockedError, mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle ORM 404 error', (done) => {
      mockedError = new ORMError('NOT_FOUND', 'Cannot find ...');
      mockedRequest.logger.getEntriesForId.callsArgWith(1, null, mockedEntries);

      mockedNext = (err) => {
        var msg = 'Next was called with an error.';
        should.not.exist(err);
        should.exist(mockedError.status);
        mockedError.status.should.equal(404);
        mockedResponse.json.calledWith(responseData);
        mockedResponse.status.calledWith(mockedError.status);
        mockedLogger.error.calledWith(msg, mockedError);
        done();
      };

      middleware.errorHandler(mockedError, mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle ORM 500 error', (done) => {
      mockedError = new ORMError('X', 'Server error');
      mockedRequest.logger.getEntriesForId.callsArgWith(1, null, mockedEntries);

      mockedNext = (err) => {
        var msg = 'Next was called with an error.';
        should.not.exist(err);
        should.exist(mockedError.status);
        mockedError.status.should.equal(500);
        mockedResponse.json.calledWith(responseData);
        mockedResponse.status.calledWith(mockedError.status);
        mockedLogger.error.calledWith(msg, mockedError);
        done();
      };

      middleware.errorHandler(mockedError, mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('database', () => {
    it('should connect to database', (done) => {
      utils.database.connection.callsArgWith(0, mockedError, mockedDb);

      mockedNext = (err) => {
        should.exist(err);
        err.should.equal(mockedError);
        should.exist(mockedRequest.db);
        mockedRequest.db.should.equal(mockedDb);
        done();
      };

      middleware.database(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('requestId', () => {
    it('should add request id', (done) => {
      mockedRequest.logger = undefined;
      mockedNext = (err) => {
        should.not.exist(err);
        mockedResponse.header.calledWith('Request-Id', mockedRequest.id);
        mockedRequest.id.should.equal(mockedUuid);
        should.exist(mockedRequest.logger);
        done();
      };

      middleware.requestId(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('serializer', () => {
    var mockedObject1, mockedObject2;
    beforeEach(() => {
      mockedObject1 = {
        serialize: sinon.stub()
      };

      mockedObject2 = {
        serialize: sinon.stub()
      };
    });

    it('should serialize single objects', (done) => {
      mockedObject1.serialize.returns('hello');

      mockedResponse.send = (payload) => {
        should.exist(payload);
        payload.should.equal('hello');

        mockedNext.calledOnce.should.be.true();
        mockedObject1.serialize.calledOnce.should.be.true();
        done();
      };

      middleware.serializer(mockedRequest, mockedResponse, mockedNext);
      mockedResponse.send(mockedObject1);
    });

    it('should serialize arrays objects and preserve order', (done) => {
      mockedObject1.serialize.returns('hello');
      mockedObject2.serialize.returns('goodbye');

      mockedResponse.send = (payload) => {
        should.exist(payload);
        payload[0].should.equal('hello');
        payload[1].should.equal('goodbye');

        mockedNext.calledOnce.should.be.true();
        mockedObject1.serialize.calledOnce.should.be.true();
        mockedObject2.serialize.calledOnce.should.be.true();
        done();
      };

      middleware.serializer(mockedRequest, mockedResponse, mockedNext);
      mockedResponse.send([mockedObject1, mockedObject2]);
    });

    it('should not serialize non-objects', (done) => {
      mockedObject1 = 123;

      mockedResponse.send = (payload) => {
        should.exist(payload);
        payload.should.equal(123);
        mockedNext.calledOnce.should.be.true();
        done();
      };

      middleware.serializer(mockedRequest, mockedResponse, mockedNext);
      mockedResponse.send(mockedObject1);
    });

    it('should not serialize if serialize is not a function', (done) => {
      mockedObject1.serialize = 'not a function';

      mockedResponse.send = (payload) => {
        should.exist(payload);
        payload.should.equal(mockedObject1);
        mockedNext.calledOnce.should.be.true();
        done();
      };

      middleware.serializer(mockedRequest, mockedResponse, mockedNext);
      mockedResponse.send(mockedObject1);
    });
  });

  describe("Authentication", () => {
    it("Should authorize existing user", (done) => {
      var mockedUser = {
        id: 13,
        name: "admin@mygroup.local",
        find: sinon.stub(),
        create: sinon.stub().throws(" DONT CALL")
      };

      mockedUser.find.callsArgWith(1, null, [mockedUser]);

      mockedRequest.user = {
        user_id: "THISISAUAAUSERID"
      };

      mockedRequest.db = {
        models: {
          user: mockedUser
        }
      };

      middleware.authorize(mockedRequest, mockedResponse, (error) => {
        should.not.exist(error);
        mockedRequest.db.models.user.find.calledWith({
          uaa_id: 'THISISAUAAUSERID'
        }).should.be.true();
        mockedRequest.db.models.user.create.calledOnce.should.be.false();
        done();
      });
    });

    it("Should create new authorized user", (done) => {
      var mockedUser = {
        id: 13,
        name: "admin@mygroup.local",
        find: sinon.stub(),
        create: sinon.stub()
      };

      mockedUser.find.callsArgWith(1, null, []);
      mockedUser.create.callsArgWith(1, null, mockedUser);

      mockedRequest.user = {
        user_id: "THISISAUAAUSERID",
        user_name: "admin@mygroup.local"
      };

      mockedRequest.db = {
        models: {
          user: mockedUser
        }
      };

      middleware.authorize(mockedRequest, mockedResponse, (error) => {
        should.not.exist(error);
        mockedRequest.db.models.user.find.calledWith({
          uaa_id: 'THISISAUAAUSERID'
        }).should.be.true();
        mockedRequest.db.models.user.create.calledOnce.should.be.true();
        var userCreateArgs = mockedRequest.db.models.user.create.getCall(0).args[0];
        userCreateArgs.username.should.be.equal('admin@mygroup.local');
        userCreateArgs.uaa_id.should.be.equal("THISISAUAAUSERID");
        done();
      });
    });

    it("Should handle errors create new authorized user", (done) => {
      var mockedUser = {
        id: 13,
        name: "admin@mygroup.local",
        find: sinon.stub(),
        create: sinon.stub()
      };

      mockedUser.find.callsArgWith(1, null, []);
      mockedUser.create.callsArgWith(1, new Error("DUPLICATE USER"), mockedUser);

      mockedRequest.user = {
        user_id: 13,
        user_name: "admin@mygroup.local"
      };

      mockedRequest.db = {
        models: {
          user: mockedUser
        }
      };

      middleware.authorize(mockedRequest, mockedResponse, (error) => {
        should.exist(error);
        mockedRequest.db.models.user.find.calledWith({
          uaa_id: 13
        }).should.be.true();
        mockedRequest.db.models.user.create.calledOnce.should.be.true();
        var userCreateArgs = mockedRequest.db.models.user.create.getCall(0).args[0];
        userCreateArgs.username.should.be.equal('admin@mygroup.local');
        userCreateArgs.uaa_id.should.be.equal(13);
        done();
      });
    });
  });


  describe("Restrict access", () => {
    it("Should block a user without the n0dejsapi.system scope", (done) => {
      var mockedUser = {
        id: 13,
        name: "admin@mygroup.local",
        scope: ['uaa.user', 'n0dejsapi.user']
      };

      mockedRequest.user = mockedUser;

      middleware.systemAccess(mockedRequest, mockedResponse, (error) => {
        should.exist(error);
        done();
      });
    });

    it("Should authorize a user with the n0dejsapi.system scope", (done) => {
      var mockedUser = {
        id: 13,
        name: "admin@mygroup.local",
        scope: ['uaa.user', 'n0dejsapi.user', 'n0dejsapi.system']
      };

      mockedRequest.user = mockedUser;

      middleware.systemAccess(mockedRequest, mockedResponse, (error) => {
        should.not.exist(error);
        done();
      });
    });


  });

  describe('serviceInfo', () => {
    it("Should get service info ", (done) => {
      middleware.__set__('utils', {
        settings: {
          crest: {
            publicUri: "http://api.n0dejs.com/v2"
          },
          auth: {
            endpoint: "http://api.n0dejs.com/v2/auth"
          }
        }
      })
      mockedResponse.send = (info) => {
        info.api_latest_version.should.be.equal(2);
        info.api_public_uri.should.be.equal('http://api.n0dejs.com/v2');
        info.auth_endpoint.should.be.equal('http://api.n0dejs.com/v2/auth');
        done();
      };

      middleware.serviceInfo(mockedRequest, mockedResponse);
    })
  });

  function ORMError(status, message) {
    this.details = `${status}: ${message}`;
    this.literalCode = `${status}`;
    this.message = message;
  }
});
