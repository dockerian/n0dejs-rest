var _ = require('lodash'),
  should = require('should'),
  sinon = require('sinon'),
  rewire = require('rewire'),
  utils = require('../utils'),
  semver = require('semver'),
  databaseHelpers = rewire('../utils/database/helpers.js');

describe('utils/database/helpers', function (done) {
  var mockedExec;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });
  });

  describe('generateKey', () => {
    beforeEach(() => {
      mockedExec = sinon.stub();

      databaseHelpers.__set__({
        shell: {
          exec: mockedExec
        }
      });
    });

    it('should generate a key', (done) => {
      mockedExec.callsArgWith(1, 0, 'key was created');

      databaseHelpers.generateKey((err) => {
        should.not.exist(err);

        mockedExec.calledOnce.should.be.true();
        mockedExec.calledWith('ssh-keygen -C "database encryption key" -t rsa -f ./tools/dbencryptionkey -P ""').should.be.true();
        done();
      });
    });

    it('should return an error when it cannot generate a key', (done) => {
      mockedExec.callsArgWith(1, 1, 'awooga, key creation failed!');

      databaseHelpers.generateKey((err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('Key creation failed.');

        mockedExec.calledOnce.should.be.true();
        mockedExec.calledWith('ssh-keygen -C "database encryption key" -t rsa -f ./tools/dbencryptionkey -P ""').should.be.true();
        done();
      });
    });
  });

  describe('setupDatabase', () => {
    beforeEach(() => {
      mockedExec = sinon.stub().callsArgWith(1, 0, 'done');

      utils.settings.proxy = {};

      utils.settings.database = {
        'user': 'user',
        'password': 'password',
        'host': 'host'
      };

      databaseHelpers.__set__({
        fs: {
          readdir: sinon.stub().callsArgWith(1, null, [
            '0.0.3',
            '0.0.1',
            '0.0.4',
            '0.0.2'
          ])
        },
        shell: {
          exec: mockedExec
        }
      });
    });

    it('should initialize the database', (done) => {
      databaseHelpers.setupDatabase(semver('0.0.0'), semver('0.0.4'), (err) => {
        should.not.exist(err);

        mockedExec.callCount.should.equal(4);
        mockedExec.getCall(0).args[0].should.equal('mysql -u user -ppassword -h host < ./database/versions/0.0.1.sql');
        mockedExec.getCall(1).args[0].should.equal('mysql -u user -ppassword -h host < ./database/versions/0.0.2.sql');
        mockedExec.getCall(2).args[0].should.equal('mysql -u user -ppassword -h host < ./database/versions/0.0.3.sql');
        mockedExec.getCall(3).args[0].should.equal('mysql -u user -ppassword -h host < ./database/versions/0.0.4.sql');
        done();
      });
    });

    it('should upgrade the database', (done) => {
      databaseHelpers.setupDatabase(semver('0.0.2'), semver('0.0.4'), (err) => {
        should.not.exist(err);

        mockedExec.calledTwice.should.be.true();
        mockedExec.getCall(0).args[0].should.equal('mysql -u user -ppassword -h host < ./database/versions/0.0.3.sql');
        mockedExec.getCall(1).args[0].should.equal('mysql -u user -ppassword -h host < ./database/versions/0.0.4.sql');
        done();
      });
    });

    it('should not upgrade past the required version', (done) => {
      databaseHelpers.setupDatabase(semver('0.0.1'), semver('0.0.3'), (err) => {
        should.not.exist(err);

        mockedExec.calledTwice.should.be.true();
        mockedExec.getCall(0).args[0].should.equal('mysql -u user -ppassword -h host < ./database/versions/0.0.2.sql');
        mockedExec.getCall(1).args[0].should.equal('mysql -u user -ppassword -h host < ./database/versions/0.0.3.sql');
        done();
      });
    });

    it('should fail on missing supported version', (done) => {
      databaseHelpers.setupDatabase(semver('0.0.2'), semver('0.0.5'), (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);

        mockedExec.called.should.be.false();
        done();
      });
    });

    it('should fail on import schema failure', (done) => {
      mockedExec.callsArgWith(1, 1, 'ruh roh, no mysql to connect to!');

      databaseHelpers.setupDatabase(semver('0.0.1'), semver('0.0.3'), (err) => {
        should.exist(err);
        err.should.be.an.instanceOf(Error);
        err.message.should.equal('Schema version [0.0.2] import failed: ruh roh, no mysql to connect to!');

        mockedExec.calledOnce.should.be.true();
        mockedExec.getCall(0).args[0].should.equal('mysql -u user -ppassword -h host < ./database/versions/0.0.2.sql');
        done();
      });
    });
  });
});
