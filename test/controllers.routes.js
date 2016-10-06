var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes');

describe('v2', () => {

  it('should touch all controllers and routes for code coverage', () => {
    var api = require('../app');
    should.exist(api);
  });
});
