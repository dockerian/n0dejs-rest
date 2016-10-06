var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  httpStatus = require('http-status-codes'),
  controller = require('../app/v2/projects/members/controller.js');

describe('v2/projects/members/controller', () => {
  var mockedRequest, mockedResponse, mockedNext, mockedNotificationTarget, mockedError;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    utils.database.connection.encryptValue = (value) => {
      return `encrypted_${value}`;
    };
  });

  beforeEach(() => {
    mockedRequest = {
      logger: utils.logger,
      db: {
        models: {
          project: {
            get: sinon.stub(),
            find: sinon.stub(),
            create: sinon.stub()
          },
          user: {
            get: sinon.stub(),
            find: sinon.stub(),
            create: sinon.stub()
          }
        }
      },
      params: {
        project_id: 1
      },
      query: {
        user_id: 2
      }
    };

    mockedResponse = {
      send: sinon.stub(),
      status: sinon.stub()
    };

    mockedProject = {
      id: 1,
      name: 'Test Project',
      hasMembers: sinon.stub(),
      addMembers: sinon.stub(),
      getMembers: sinon.stub()
    };

    mockedUser = {
      user_id: 2
    };

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');
    mockedRequest.user = mockedUser;
  });

  describe('getMemberForProject', () => {
    it('should return not implemented error when getting a member for a project', (done) => {
      mockedNext = (err) => {
        err.message.should.equal('NOT IMPLEMENTED');
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.getMemberForProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('removeMemberFromProject', () => {
    it('should return not implemented error when removing a member from a project', (done) => {
      mockedNext = (err) => {
        err.message.should.equal('NOT IMPLEMENTED');
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };
      controller.removeMemberFromProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('addMemberToProject', () => {
    it('should add a member to a project', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, [mockedProject]);
      mockedRequest.db.models.user.get.callsArgWith(1, null, mockedUser);
      mockedProject.hasMembers.callsArgWith(1, null, false);
      mockedProject.addMembers.callsArgWith(1, null);
      mockedResponse.status.returns(mockedResponse);

      mockedResponse.send = () => {
        mockedNext.called.should.be.false();
        mockedResponse.status.calledWith(httpStatus.CREATED).should.be.true();
        mockedResponse.status.calledOnce.should.be.true();
        done();
      };

      controller.addMemberToProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when there is no user id when adding a member to a project', (done) => {
      mockedRequest.user.user_id = null;

      mockedNext = (err) => {
        err.message.should.equal('Invalid parameters provided.');
        err.status.should.equal(httpStatus.BAD_REQUEST);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.addMemberToProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when project cannot be found when adding a member to a project', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, []);

      mockedNext = (err) => {
        err.message.should.equal('Invalid parameters provided.');
        err.status.should.equal(httpStatus.BAD_REQUEST);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.addMemberToProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when user get fails when adding a member to a project', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, [mockedProject]);
      mockedRequest.db.models.user.get.callsArgWith(1, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.addMemberToProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when user is already a member on the project', (done) => {
      mockedRequest.db.models.project.find.callsArgWith(1, null, [mockedProject]);
      mockedRequest.db.models.user.get.callsArgWith(1, null, mockedUser);
      mockedProject.hasMembers.callsArgWith(1, null, true);

      mockedNext = (err) => {
        err.message.should.equal('You\'re already a collaborator on this project.');
        err.status.should.equal(httpStatus.BAD_REQUEST);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.addMemberToProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('listMembersForProject', () => {
    it('should list all members for a project', (done) => {
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getMembers.callsArgWith(0, null, [mockedUser]);

      mockedResponse.send = (payload) => {
        mockedNext.called.should.be.false();
        payload.length.should.equal(1);
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.listMembersForProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when there is no project', (done) => {
      mockedRequest.db.models.project.get.callsArgWith(1, null, null);

      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no project:${mockedRequest.params.projectId}`);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.listMembersForProject(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when project getMembers fails', (done) => {
      mockedRequest.db.models.project.get.callsArgWith(1, null, mockedProject);
      mockedProject.getMembers.callsArgWith(0, mockedError);

      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.listMembersForProject(mockedRequest, mockedResponse, mockedNext);
    });
  });

});
