var _ = require('lodash'),
  async = require('async'),
  should = require('should'),
  sinon = require('sinon'),
  orm = require('orm'),
  utils = require('../utils');

describe('utils/database/connection', function (done) {
  var mockORM, mockConnection;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });
  });

  beforeEach(() => {
    // connection is a singleton, lets flush the singleton for each test.
    delete require.cache[require.resolve('../utils/database/connection.js')];
    utils.database.connection = require('../utils/database/connection.js');

    orm.connect = sinon.stub();

    mockConnection = {
      define: sinon.stub(),
      driver: {
        db: {
          state: 'authenticated'
        }
      },
      models: {
        build: {
          hasOne: sinon.stub()
        },
        artifact: {
          hasOne: sinon.stub()
        },
        build_step: {
          hasOne: sinon.stub()
        },
        deployment: {
          hasOne: sinon.stub()
        },
        credential: {
          hasOne: sinon.stub()
        },
        image_registry: {
          hasOne: sinon.stub()
        },
        image: {
          hasOne: sinon.stub()
        },
        project: {
          hasOne: sinon.stub(),
          hasMany: sinon.stub()
        },
        deploymentTarget: {
          hasOne: sinon.stub()
        },
        build_container: {
          hasOne: sinon.stub()
        },
        notificationtarget: {
          hasOne: sinon.stub()
        },
        pipeline_task: {
          hasOne: sinon.stub()
        },
        vcs: {
          hasOne: sinon.stub()
        },
        encryptedType: {
          beforeSave: sinon.stub(),
          afterSave: sinon.stub(),
          afterLoad: sinon.stub(),
          allProperties: [{
            name: 'encrypted_property',
            encrypted: true
          }]
        }
      },
      settings: {
        set: sinon.stub()
      }
    };
  });

  it('Can setup associations', (done) => {
    orm.connect.callsArgWith(1, null, mockConnection);

    utils.database.connection((err, connection) => {
      should.not.exist(err);
      should.exist(connection);

      mockConnection.models.build.hasOne.calledWith('project').should.be.true();
      mockConnection.models.notificationtarget.hasOne.calledWith('project').should.be.true();

      mockConnection.models.project.hasOne.calledWith('deploymentTarget').should.be.true();
      mockConnection.models.project.hasOne.calledWith('applicationImage').should.be.true();
      mockConnection.models.project.hasOne.calledWith('buildContainer').should.be.true();
      mockConnection.models.project.hasMany.calledWith('members').should.be.true();
      mockConnection.models.project.hasOne.calledWith('vcs').should.be.true();
      mockConnection.models.project.hasOne.calledWith('credential').should.be.true();

      mockConnection.models.deploymentTarget.hasOne.calledWith('user').should.be.true();

      mockConnection.models.build_step.hasOne.calledWith('build').should.be.true();
      mockConnection.models.artifact.hasOne.calledWith('build').should.be.true();
      mockConnection.models.deployment.hasOne.calledWith('build').should.be.true();

      mockConnection.models.build_step.hasOne.calledWith('artifact').should.be.true();

      mockConnection.models.vcs.hasOne.calledWith('vcs_type').should.be.true();
      mockConnection.models.vcs.hasOne.calledWith('credential').should.be.true();

      mockConnection.models.pipeline_task.hasOne.calledWith('project').should.be.true();
      mockConnection.models.pipeline_task.hasOne.calledWith('credential').should.be.true();

      done();
    });
  });

  it('Can handle connection failures to database ', (done) => {
    var connectionError = new Error('server down');
    orm.connect.callsArgWith(1, connectionError);

    utils.database.connection((err, connection) => {
      should.exist(err);
      err.should.be.an.instanceof(Error);
      err.should.be.equal(connectionError);
      done();
    });
  });

  it('Can setup encryption', (done) => {
    orm.connect.callsArgWith(1, null, mockConnection);

    utils.database.connection((err, connection) => {
      should.not.exist(err);
      mockConnection.models.encryptedType.beforeSave.calledOnce.should.be.true();
      mockConnection.models.encryptedType.afterSave.calledOnce.should.be.true();
      mockConnection.models.encryptedType.afterLoad.calledOnce.should.be.true();
      done();
    });
  });

  it('Remembers that it is connected', (done) => {
    orm.connect.callsArgWith(1, null, mockConnection);

    async.parallel([
      utils.database.connection,
      utils.database.connection,
      utils.database.connection,
      utils.database.connection
    ], (err, connections) => {
      should.not.exist(err);
      orm.connect.calledOnce.should.be.true();
      connections.every((connection) => {
        connection.should.equal(mockConnection);
        return true;
      });

      done();
    });
  });
});
