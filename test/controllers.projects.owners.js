var should = require('should'),
  sinon = require('sinon'),
  controller = require('../app/v2/projects/owners/controller.js');

describe('v2/projects/owners/controller', () => {
  var mockedRequest, mockedResponse, mockedNext;

  beforeEach(() => {
    mockedResponse = {
      send: sinon.stub(),
      status: sinon.stub()
    };

    mockedNext = sinon.stub();
  });

  describe('getOwnerForProject', () => {
    it('should return not implemented error when getting a owner for a project', (done) => {
      mockedNext = (err) => {
        err.message.should.equal('NOT IMPLEMENTED');
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.getOwnerForProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('removeOwnerFromProject', () => {
    it('should return not implemented error when removing a owner for a project', (done) => {
      mockedNext = (err) => {
        err.message.should.equal('NOT IMPLEMENTED');
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.removeOwnerFromProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('addOwnerToProject', () => {
    it('should return not implemented error when adding a owner for a project', (done) => {
      mockedNext = (err) => {
        err.message.should.equal('NOT IMPLEMENTED');
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.addOwnerToProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('listOwnersForProject', () => {
    it('should return not implemented error when listing owners for a project', (done) => {
      mockedNext = (err) => {
        err.message.should.equal('NOT IMPLEMENTED');
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.listOwnersForProject(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
