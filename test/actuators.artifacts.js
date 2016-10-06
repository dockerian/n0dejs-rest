var _ = require('lodash'),
  events = require('events'),
  rewire = require('rewire'),
  stream = require('stream'),
  should = require('should'),
  sinon = require('sinon'),
  uuid = require('uuid'),
  utils = require('../utils'),
  artifactsActuator = rewire('../utils/actuators/artifacts.js');

describe('actuators/artifacts', () => {
  var mockedArtifact, mockedFs, mockedConnection, logger, testId;
  var savedConnection, savedClient;

  before(() => {
    savedConnection = utils.database.connection;
    savedClient = utils.concourse.client;

    mockedFs = {};
    artifactsActuator.__set__('fs', mockedFs);

    utils.logger.transports['buffer'].level = 'debug';
    utils.logger.transports['console'].level = 'silent';
  });

  beforeEach(() => {
    testId = uuid.v1();
    logger = utils.logger.shim(utils.logger, testId);

    mockedConnection = {
      models: {
        artifact: {
          create: sinon.stub()
        }
      }
    };

    mockedArtifact = {
      id: 123,
      name: 'some_file.txt',
      build_id: 456,
      type: 'test',
      createdDate: new Date(Date.now())
    };

    mockedFs.lstat = sinon.stub();
    mockedFs.unlink = sinon.stub();
    mockedFs.writeFile = sinon.stub();
    mockedFs.createWriteStream = sinon.stub();
    mockedFs.createReadStream = sinon.stub();

    utils.database.connection = sinon.stub();
    utils.database.connection.callsArgWith(0, null, mockedConnection);
  });

  after(() => {
    utils.database.connection = savedConnection;
    utils.concourse.client = savedClient;
  });

  describe('createArtifact', () => {
    var mockedContentsStream, mockedFileStream;

    beforeEach(() => {
      mockedContentsStream = new stream.Readable();
      mockedFileStream = new stream.Writable();

      mockedContentsStream._read = () => "";
      mockedFileStream._write = () => {};
    });

    it('should create an artifact with contents as stream', (done) => {
      mockedFs.createWriteStream.returns(mockedFileStream);
      mockedConnection.models.artifact.create.callsArgWith(1, null, mockedArtifact);

      artifactsActuator.createArtifact(mockedArtifact, mockedContentsStream, logger, (err, artifact) => {
        should.not.exist(err);
        artifact.should.equal(mockedArtifact);

        mockedFs.createWriteStream.calledOnce.should.be.true();
        mockedFs.createWriteStream.calledWith('/artifacts/some_file.txt').should.be.true();
        mockedFs.writeFile.called.should.be.false();
        mockedFs.unlink.called.should.be.false();

        mockedConnection.models.artifact.create.calledOnce.should.be.true();
        mockedConnection.models.artifact.create.calledWith(mockedArtifact).should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].message.should.equal(`${testId} : CreateArtifact : Begin writing 'some_file.txt' to disk.`);
          entries[1].message.should.equal(`${testId} : CreateArtifact : Completed writing 'some_file.txt' to disk.`);
          return done();
        });
      });

      mockedFileStream.emit('finish');
    });

    it('should handle stream errors when creating an artifact with contents as stream', (done) => {
      mockedFs.createWriteStream.throws(new Error('cannot create stream!'));
      mockedConnection.models.artifact.create.callsArgWith(1, null, mockedArtifact);

      artifactsActuator.createArtifact(mockedArtifact, mockedContentsStream, logger, (err, artifact) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('cannot create stream!');
        should.not.exist(artifact);

        mockedFs.createWriteStream.calledOnce.should.be.true();
        mockedFs.createWriteStream.calledWith('/artifacts/some_file.txt').should.be.true();
        mockedFs.writeFile.called.should.be.false();
        mockedFs.unlink.called.should.be.false();

        mockedConnection.models.artifact.create.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].message.should.equal(`${testId} : CreateArtifact : Begin writing 'some_file.txt' to disk.`);
          entries[1].message.should.equal(`${testId} : CreateArtifact : Unable to create filestream for file '/artifacts/some_file.txt'`);
          return done();
        });
      });
    });

    it('should handle write errors when creating an artifact with contents as stream', (done) => {
      mockedFs.createWriteStream.returns(mockedFileStream);
      mockedConnection.models.artifact.create.callsArgWith(1, null, mockedArtifact);

      artifactsActuator.createArtifact(mockedArtifact, mockedContentsStream, logger, (err, artifact) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('streaming to disk oh noes!');
        should.not.exist(artifact);

        mockedFs.createWriteStream.calledOnce.should.be.true();
        mockedFs.createWriteStream.calledWith('/artifacts/some_file.txt').should.be.true();
        mockedFs.writeFile.called.should.be.false();
        mockedFs.unlink.called.should.be.false();
        mockedConnection.models.artifact.create.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].message.should.equal(`${testId} : CreateArtifact : Begin writing 'some_file.txt' to disk.`);
          entries[1].message.should.equal(`${testId} : CreateArtifact : Unable to stream file 'some_file.txt' to disk: streaming to disk oh noes!`);
          return done();
        });
      });

      mockedFileStream.emit('error', new Error('streaming to disk oh noes!'));
    });

    it('should create an artifact with contents as string', (done) => {
      mockedFs.writeFile.callsArgWith(2, null);
      mockedConnection.models.artifact.create.callsArgWith(1, null, mockedArtifact);

      artifactsActuator.createArtifact(mockedArtifact, 'contents', logger, (err, artifact) => {
        should.not.exist(err);
        artifact.should.equal(mockedArtifact);

        mockedFs.writeFile.calledOnce.should.be.true();
        mockedFs.writeFile.calledWith('/artifacts/some_file.txt', 'contents').should.be.true();
        mockedFs.createWriteStream.called.should.be.false();
        mockedFs.unlink.called.should.be.false();

        mockedConnection.models.artifact.create.calledOnce.should.be.true();
        mockedConnection.models.artifact.create.calledWith(mockedArtifact).should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].message.should.equal(`${testId} : CreateArtifact : Begin writing 'some_file.txt' to disk.`);
          entries[1].message.should.equal(`${testId} : CreateArtifact : Completed writing 'some_file.txt' to disk.`);
          return done();
        });
      });
    });

    it('should create an artifact with contents as string', (done) => {
      mockedFs.writeFile.callsArgWith(2, new Error('cannot write file!'));
      mockedConnection.models.artifact.create.callsArgWith(1, null, mockedArtifact);

      artifactsActuator.createArtifact(mockedArtifact, 'contents', logger, (err, artifact) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('cannot write file!');
        should.not.exist(artifact);

        mockedFs.writeFile.calledOnce.should.be.true();
        mockedFs.writeFile.calledWith('/artifacts/some_file.txt', 'contents').should.be.true();
        mockedFs.createWriteStream.called.should.be.false();
        mockedFs.unlink.called.should.be.false();
        mockedConnection.models.artifact.create.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].message.should.equal(`${testId} : CreateArtifact : Begin writing 'some_file.txt' to disk.`);
          entries[1].message.should.equal(`${testId} : CreateArtifact : Unable to save file 'some_file.txt' to disk: cannot write file!`);
          return done();
        });
      });
    });

    it('should handle db and unlink errors correctly', (done) => {
      mockedFs.writeFile.callsArgWith(2, null);
      mockedFs.unlink.callsArgWith(1, new Error('couldnt unlink!'));
      mockedConnection.models.artifact.create.callsArgWith(1, new Error('ORM oh noes!'), mockedArtifact);

      artifactsActuator.createArtifact(mockedArtifact, 'contents', logger, (err, artifact) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('ORM oh noes!'); // we want the ORM error, not the unlink error!
        should.not.exist(artifact);

        mockedFs.writeFile.calledOnce.should.be.true();
        mockedFs.writeFile.calledWith('/artifacts/some_file.txt', 'contents').should.be.true();
        mockedFs.createWriteStream.called.should.be.false();
        mockedFs.unlink.called.should.be.true();
        mockedFs.unlink.calledWith('/artifacts/some_file.txt').should.be.true();

        mockedConnection.models.artifact.create.calledOnce.should.be.true();
        mockedConnection.models.artifact.create.calledWith(mockedArtifact).should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(3);
          entries[0].message.should.equal(`${testId} : CreateArtifact : Begin writing 'some_file.txt' to disk.`);
          entries[1].message.should.equal(`${testId} : CreateArtifact : Completed writing 'some_file.txt' to disk.`);
          entries[2].message.should.equal(`${testId} : CreateArtifact : Delete for container '/artifacts/some_file.txt' failed. The file has leaked.`);
          entries[0].level.should.equal('info');
          entries[1].level.should.equal('info');
          entries[2].level.should.equal('error');
          should.exist(entries[2].stack);
          return done();
        });
      });
    });

    it('should handle db and unlink errors correctly when ORM behaves unexpectedly', (done) => {
      mockedFs.writeFile.callsArgWith(2, null);
      mockedFs.unlink.callsArgWith(1, new Error('couldnt unlink!'));
      mockedConnection.models.artifact.create.callsArgWith(1, null, null);

      artifactsActuator.createArtifact(mockedArtifact, 'contents', logger, (err, artifact) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('ORM returned no error, and no created artifact for execution id: 456');
        should.not.exist(artifact);

        mockedFs.writeFile.calledOnce.should.be.true();
        mockedFs.writeFile.calledWith('/artifacts/some_file.txt', 'contents').should.be.true();
        mockedFs.createWriteStream.called.should.be.false();
        mockedFs.unlink.called.should.be.true();
        mockedFs.unlink.calledWith('/artifacts/some_file.txt').should.be.true();

        mockedConnection.models.artifact.create.calledOnce.should.be.true();
        mockedConnection.models.artifact.create.calledWith(mockedArtifact).should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(3);
          entries[0].message.should.equal(`${testId} : CreateArtifact : Begin writing 'some_file.txt' to disk.`);
          entries[1].message.should.equal(`${testId} : CreateArtifact : Completed writing 'some_file.txt' to disk.`);
          entries[2].message.should.equal(`${testId} : CreateArtifact : Delete for container '/artifacts/some_file.txt' failed. The file has leaked.`);
          entries[0].level.should.equal('info');
          entries[1].level.should.equal('info');
          entries[2].level.should.equal('error');
          should.exist(entries[2].stack);
          return done();
        });
      });
    });

    it('should handle db connection and unlink errors correctly', (done) => {
      mockedFs.writeFile.callsArgWith(2, null);
      mockedFs.unlink.callsArgWith(1, new Error('couldnt unlink!'));
      utils.database.connection.callsArgWith(0, new Error('no connection for you!'));

      artifactsActuator.createArtifact(mockedArtifact, 'contents', logger, (err, artifact) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('no connection for you!'); // we want the ORM error, not the unlink error!
        should.not.exist(artifact);

        mockedFs.writeFile.calledOnce.should.be.true();
        mockedFs.writeFile.calledWith('/artifacts/some_file.txt', 'contents').should.be.true();
        mockedFs.createWriteStream.called.should.be.false();
        mockedFs.unlink.called.should.be.true();
        mockedFs.unlink.calledWith('/artifacts/some_file.txt').should.be.true();
        mockedConnection.models.artifact.create.calledOnce.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(4);
          entries[0].message.should.equal(`${testId} : CreateArtifact : Begin writing 'some_file.txt' to disk.`);
          entries[1].message.should.equal(`${testId} : CreateArtifact : Completed writing 'some_file.txt' to disk.`);
          entries[2].message.should.equal(`${testId} : CreateArtifact : Could not establish connection to save artifact.`);
          entries[3].message.should.equal(`${testId} : CreateArtifact : Delete for container '/artifacts/some_file.txt' failed. The file has leaked.`);
          entries[0].level.should.equal('info');
          entries[1].level.should.equal('info');
          entries[3].level.should.equal('error');
          should.exist(entries[3].stack);
          return done();
        });
      });
    });
  });

  describe('getArtifactContent', () => {
    var mockedReadStream;

    beforeEach(() => {
      mockedReadStream = new stream.Readable();
      mockedReadStream._read = () => "";
    });

    it('should get artifact content as a stream', (done) => {
      mockedFs.createReadStream.returns(mockedReadStream);
      mockedFs.lstat.callsArgWith(1, null, true);

      artifactsActuator.getArtifactContent(mockedArtifact, logger, (err, filestream) => {
        should.exist(stream);
        should.not.exist(err);
        filestream.should.be.an.instanceof(stream.Stream);

        mockedFs.lstat.calledOnce.should.be.true();
        mockedFs.createReadStream.calledOnce.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].message.should.equal(`${testId} : GetArtifactContent : Begin streaming file from disk: some_file.txt`);
          entries[1].message.should.equal(`${testId} : GetArtifactContent : Finished streaming file from disk: some_file.txt`);
          return done();
        });
      });

      mockedReadStream.emit('finish');
    });

    it('should return an error when the file doesnt exist', (done) => {
      mockedFs.lstat.callsArgWith(1, new Error('file not found :('));

      artifactsActuator.getArtifactContent(mockedArtifact, logger, (err, filestream) => {
        should.exist(err);
        should.not.exist(filestream);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('file not found :(');

        mockedFs.lstat.calledOnce.should.be.true();
        mockedFs.createReadStream.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(1);
          entries[0].message.should.equal(`${testId} : GetArtifactContent : Unable to locate file on disk with path: /artifacts/some_file.txt`);
          entries[0].level.should.equal('error');
          return done();
        });
      });
    });

    it('should notify of streaming errors when getting artifact content', (done) => {
      mockedFs.createReadStream.returns(mockedReadStream);
      mockedFs.lstat.callsArgWith(1, null, true);

      artifactsActuator.getArtifactContent(mockedArtifact, logger, (err, filestream) => {
        should.exist(stream);
        should.not.exist(err);
        filestream.should.be.an.instanceof(stream.Stream);

        mockedFs.lstat.calledOnce.should.be.true();
        mockedFs.createReadStream.calledOnce.should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].message.should.equal(`${testId} : GetArtifactContent : Begin streaming file from disk: some_file.txt`);
          entries[1].message.should.equal(`${testId} : GetArtifactContent : Error streaming file from disk: some_file.txt`);
          entries[1].level.should.equal('error');
          return done();
        });
      });

      mockedReadStream.emit('error', new Error('streaming error sadface'));
    });
  });

  describe('deleteArtifactContent', () => {
    it('should delete artifact content from disk', (done) => {
      mockedFs.unlink.callsArgWith(1, null);

      artifactsActuator.deleteArtifactContent(mockedArtifact, logger, (err) => {
        should.not.exist(err);
        mockedFs.unlink.calledOnce.should.be.true();
        mockedFs.unlink.calledWith('/artifacts/some_file.txt').should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(1);
          entries[0].message.should.equal(`${testId} : DeleteArtifactContent : Removing file from disk: some_file.txt`);
          return done();
        });
      });
    });

    it('should return an error when deleting artifact content from disk', (done) => {
      mockedFs.unlink.callsArgWith(1, new Error('couldnt unlink sadface'));

      artifactsActuator.deleteArtifactContent(mockedArtifact, logger, (err) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('couldnt unlink sadface');

        mockedFs.unlink.calledOnce.should.be.true();
        mockedFs.unlink.calledWith('/artifacts/some_file.txt').should.be.true();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries.length.should.equal(2);
          entries[0].message.should.equal(`${testId} : DeleteArtifactContent : Removing file from disk: some_file.txt`);
          entries[1].message.should.equal(`${testId} : DeleteArtifactContent : Delete for container '/artifacts/some_file.txt' failed. The file may have leaked.`);
          return done();
        });
      });
    });
  });
});
