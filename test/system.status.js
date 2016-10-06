var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  controller = require('../app/status/controller.js');

describe('system_status/controller', () => {
  var mockedRequest, mockedResponse, mockedNext, mockedError;
  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });
  });

  var clientBackup = utils.concourse.client;

  beforeEach(() => {
    mockedRequest = {
      logger: utils.logger,
      query: {},
      body: {},
      db: {
        driver: {
          execQuery: sinon.stub()
        }
      }
    };


    mockedResponse = {
      status: sinon.stub(),
      send: sinon.stub()
    };

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');

    utils.concourse.client = () => {
      return {
        loginAndSync: sinon.stub().callsArgWith(0, null)
      };
    };
  });

  after(() => {
    utils.concourse.client = clientBackup;
  });

  describe('getStatus', () => {
    it('should get system status', (done) => {
      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.driver.execQuery.callsArgWith(1, null, [{
        version: '1'
      }]);
      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.api_version);
        payload.api_version.should.equal(2);
        mockedNext.called.should.be.false();
        done();
      };

      controller.getStatus(mockedRequest, mockedResponse, mockedNext);
    });

    it('should handle errors getting system status', (done) => {
      mockedResponse.status.returns(mockedResponse);
      // mockedRequest.db.driver.execQuery.throws(" ERROR");
      mockedRequest.db.driver.execQuery.callsArgWith(1, new Error("Cannot access Mysql Server"));
      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.api_version);
        payload.api_version.should.equal(2);
        mockedNext.called.should.be.false();
        done();
      };

      mockedNext = sinon.stub().throws(" NEXT");

      controller.getStatus(mockedRequest, mockedResponse, mockedNext);
    });

    it('should fail to connect to data base and get schema version', (done) => {
      mockedResponse.status.returns(mockedResponse);
      mockedRequest.db.driver.execQuery.callsArgWith(1, null, []);
      mockedResponse.send = (payload) => {
        should.exist(payload);
        should.exist(payload.api_version);
        payload.api_version.should.equal(2);
        payload.db_schema_version.should.equal("Can not retrieve data base schema version");
        mockedNext.called.should.be.false();
        done();
      };

      controller.getStatus(mockedRequest, mockedResponse, mockedNext);
    });

  });
});
