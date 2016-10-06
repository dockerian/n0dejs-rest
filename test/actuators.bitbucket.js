var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  bitbucket = rewire('../utils/actuators/common'),
  utils = require('../utils');

describe('actuators/bitbucket', () => {
  var mockedPipelines, mockedLogger;

  after(() => {
    delete require.cache[require.resolve('../utils/actuators')];
  });

  describe('processPRClosed', () => {
    before(() => {

      _.each(utils.logger.transports, (transport) => {
        transport.level = 'silent';
      });

      mockedPipelines = {
        startExecution: sinon.stub()
      };

      bitbucket.__set__('actuators.pipelines', mockedPipelines);
    });

    it("Should handle failed processing", (done) => {
      var mockedError = new Error("Failed starting pipeline");
      mockedPipelines.startExecution.callsArgWith(4, mockedError)
      bitbucket.processPRClosed({}, {}, utils.logger, (err) => {
        err.should.be.equal(mockedError);
        done();
      })
    });
  });
});
