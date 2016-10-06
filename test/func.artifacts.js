var _ = require('lodash'),
  fs = require('fs'),
  http = require('http'),
  httpStatus = require('http-status-codes'),
  request = require('request'),
  randomstring = require('randomstring'),
  should = require('should'),
  sinon = require('sinon'),
  utils = require('../utils'),
  testHelpers = require('./_helpers.js'),
  controller = require('../app/v2/artifacts/controller.js');

describe('func/artifacts', () => {
  var server, tmpdir = `${__dirname}/tmp`;
  var mockedRequest, mockedNext, mockedArtifact, mockedError;
  var savedConnection;

  before(() => {
    // Silence!
    _.each(utils.logger.transports, (transport) => {
      transport.level = 'silent';
    });

    savedConnection = utils.database.connection;
  });

  beforeEach(() => {
    utils.settings.storage.containerPath = tmpdir;

    if (!fs.existsSync(tmpdir)) {
      fs.mkdirSync(tmpdir);
    }

    mockedRequest = {
      logger: utils.logger,
      params: {
        artifact_id: 1
      },
      query: {
        execution_id: 1
      },
      body: {
        project_id: 1,
        name: 'deployment name'
      },
      db: {
        models: {
          artifact: {
            get: sinon.stub(),
            remove: sinon.stub(),
            find: sinon.stub(),
            create: sinon.stub()
          }
        }
      }
    };

    mockedNext = sinon.stub();

    mockedArtifact = {
      id: 1,
      remove: sinon.stub()
    };

    mockedError = new Error('Mocked Error');

    utils.database.connection = sinon.stub();
    utils.database.connection.callsArgWith(0, null, mockedRequest.db);
  });

  afterEach(() => {
    _.each(fs.readdirSync(tmpdir), (file) => {
      fs.unlinkSync(`${tmpdir}/${file}`);
    });

    fs.rmdirSync(tmpdir);
  });

  after(() => {
    utils.database.connection = savedConnection;
  });

  describe('uploadArtifact', () => {
    afterEach((done) => {
      if (server) {
        return server.close(done);
      }

      return done();
    });

    it('should receive and save an artifact', (done) => {
      var logContents = randomstring.generate(parseInt(Math.random() * 1000));

      mockedRequest.query.artifact_type = 'test';
      mockedRequest.db.models.artifact.create.callsArgWith(1, null, mockedArtifact);

      uploadServerHelper(controller.uploadArtifact, logContents, (res) => {
        mockedNext.called.should.be.false();

        var createdArtifact;
        mockedRequest.db.models.artifact.create.calledOnce.should.be.true();
        createdArtifact = mockedRequest.db.models.artifact.create.getCall(0).args[0];

        should.exist(createdArtifact);
        should.exist(createdArtifact.name);
        should.exist(createdArtifact.type);
        should.exist(createdArtifact.build_id);

        createdArtifact.type.should.equal('test');
        createdArtifact.build_id.should.equal(mockedRequest.query.execution_id);

        getFileContents(createdArtifact.name).should.equal(logContents);

        res.statusCode.should.equal(httpStatus.CREATED);
        res.body.should.equal(JSON.stringify(mockedArtifact));

        done();
      });
    });

    it('should not create a db entry if unable to save artifact to disk', (done) => {
      var logContents = randomstring.generate(parseInt(Math.random() * 1000)),
        isErrorHandled = false;

      utils.settings.storage.containerPath = '/you/cannot/write/here';
      mockedRequest.query.artifact_type = 'test';

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.indexOf('ENOENT: no such file or directory').should.equal(0);
        err.code.should.equal('ENOENT');
        isErrorHandled = true;
      };

      uploadServerHelper(controller.uploadArtifact, logContents, (res) => {
        isErrorHandled.should.be.true();
        mockedRequest.db.models.artifact.create.called.should.be.false();

        // set it back
        utils.settings.storage.containerPath = tmpdir;
        done();
      });
    });

    it('should not leave file on disk when unable to create artifact row', (done) => {
      var logContents = randomstring.generate(parseInt(Math.random() * 1000)),
        isErrorHandled = false;

      mockedRequest.query.artifact_type = 'test';
      mockedRequest.db.models.artifact.create.callsArgWith(1, mockedError, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal(mockedError.message);
        isErrorHandled = true;
      };

      uploadServerHelper(controller.uploadArtifact, logContents, (res) => {
        isErrorHandled.should.be.true();
        mockedRequest.db.models.artifact.create.calledOnce.should.be.true();
        createdArtifact = mockedRequest.db.models.artifact.create.getCall(0).args[0];

        should.exist(createdArtifact);
        should.exist(createdArtifact.name);
        should.exist(createdArtifact.type);
        should.exist(createdArtifact.build_id);

        createdArtifact.type.should.equal('test');
        createdArtifact.build_id.should.equal(mockedRequest.query.execution_id);
        res.statusCode.should.not.equal(httpStatus.CREATED);

        fs.lstat(`${tmpdir}/${createdArtifact.name}`, (err, exists) => {
          // we should receive an error because the file should not exist.
          should.exist(err);
          err.message.indexOf('ENOENT: no such file or directory').should.equal(0);
          err.code.should.equal('ENOENT');
          done();
        });
      });
    });

    it('should warn us if it does leak files onto disk', (done) => {
      var logContents = randomstring.generate(parseInt(Math.random() * 1000)),
        isErrorHandled = false,
        unlinkBackup = fs.unlink,
        unlinkError = new Error('special unlink error');

      // some extra mocks for this test only
      fs.unlink = sinon.stub().callsArgWith(1, unlinkError);
      mockedRequest.logger = {
        warn: sinon.stub(),
        error: sinon.stub(),
        info: sinon.stub(),
        debug: sinon.stub()
      };

      mockedRequest.query.artifact_type = 'test';
      mockedRequest.db.models.artifact.create.callsArgWith(1, mockedError, null);

      mockedNext = (err) => {
        // this should be the error thrown from ORM.create, not fs.unlink
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal(mockedError.message);
        isErrorHandled = true;
      };

      uploadServerHelper(controller.uploadArtifact, logContents, (res) => {
        isErrorHandled.should.be.true();
        mockedRequest.db.models.artifact.create.calledOnce.should.be.true();
        createdArtifact = mockedRequest.db.models.artifact.create.getCall(0).args[0];

        should.exist(createdArtifact);
        should.exist(createdArtifact.name);
        should.exist(createdArtifact.type);
        should.exist(createdArtifact.build_id);

        createdArtifact.type.should.equal('test');
        createdArtifact.build_id.should.equal(mockedRequest.query.execution_id);
        res.statusCode.should.not.equal(httpStatus.CREATED);

        mockedRequest.logger.error.calledOnce.should.be.true();
        fs.unlink.calledOnce.should.be.true();

        // restore extra mocks
        mockedRequest.logger = utils.logger;
        fs.unlink = unlinkBackup;

        done();
      });
    });
  });

  describe('downloadArtifact', () => {
    afterEach((done) => {
      if (server) {
        return server.close(done);
      }

      return done();
    });

    it('should stream an artifact', (done) => {
      var logContents = randomstring.generate(parseInt(Math.random() * 1000)),
        readFromPath = `server`, // will be prepended in the controller with the storage path.
        saveToPath = `${tmpdir}/client`;

      fs.writeFileSync(`${utils.settings.storage.containerPath}/${readFromPath}`, logContents);

      mockedArtifact.name = readFromPath;
      mockedRequest.db.models.artifact.find.callsArgWith(1, null, [mockedArtifact]);

      downloadServerHelper(controller.downloadArtifact, saveToPath, (res) => {
        mockedNext.called.should.be.false();
        mockedRequest.db.models.artifact.find.calledOnce.should.be.true();
        mockedRequest.db.models.artifact.find.getCall(0).args[0].id.should.equal(1);

        testHelpers.compareFilesByLinesSync(`${utils.settings.storage.containerPath}/${readFromPath}`, saveToPath);

        res.statusCode.should.equal(httpStatus.OK);
        should.exist(res.headers['content-disposition']);
        should.exist(res.headers['content-type']);
        res.headers['content-disposition'].should.equal('attachment; filename=server.log');
        res.headers['content-type'].should.equal('text/plain');

        done();
      });
    });

    it('should call next when missing artifact file', (done) => {
      var logContents = randomstring.generate(parseInt(Math.random() * 1000)),
        readFromPath = `doesnt_exist_server`, // will be prepended in the controller with the storage path.
        saveToPath = `${tmpdir}/client`,
        isErrorHandled = false;

      mockedArtifact.name = readFromPath;
      mockedRequest.db.models.artifact.find.callsArgWith(1, null, [mockedArtifact]);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.indexOf('ENOENT: no such file or directory').should.equal(0);
        err.code.should.equal('ENOENT');

        isErrorHandled = true;
      };

      downloadServerHelper(controller.downloadArtifact, saveToPath, (res) => {
        isErrorHandled.should.be.true();
        mockedRequest.db.models.artifact.find.calledOnce.should.be.true();
        mockedRequest.db.models.artifact.find.getCall(0).args[0].id.should.equal(1);
        isErrorHandled.should.be.true();

        should.not.exist(res.headers['content-disposition']);
        should.not.exist(res.headers['content-type']);

        done();
      });
    });

    it('should call next when unexpected number of artifacts returned', (done) => {
      var logContents = randomstring.generate(parseInt(Math.random() * 1000)),
        readFromPath = `doesnt_exist_server`, // will be prepended in the controller with the storage path.
        saveToPath = `${tmpdir}/client`,
        isErrorHandled = false;

      mockedArtifact.name = readFromPath;
      mockedRequest.db.models.artifact.find.callsArgWith(1, null, [mockedArtifact, mockedArtifact]);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal('ORM returned no error, and no artifact with id:1');
        isErrorHandled = true;
      };

      downloadServerHelper(controller.downloadArtifact, saveToPath, (res) => {
        isErrorHandled.should.be.true();
        mockedRequest.db.models.artifact.find.calledOnce.should.be.true();
        mockedRequest.db.models.artifact.find.getCall(0).args[0].id.should.equal(1);

        should.not.exist(res.headers['content-disposition']);
        should.not.exist(res.headers['content-type']);

        done();
      });
    });

    it('should call next when ORM throws an error', (done) => {
      var logContents = randomstring.generate(parseInt(Math.random() * 1000)),
        readFromPath = `doesnt_exist_server`, // will be prepended in the controller with the storage path.
        saveToPath = `${tmpdir}/client`,
        isErrorHandled = false;

      mockedArtifact.name = readFromPath;
      mockedRequest.db.models.artifact.find.callsArgWith(1, mockedError, null);

      mockedNext = (err) => {
        should.exist(err);
        err.should.be.an.instanceof(Error);
        err.message.should.equal(mockedError.message);
        isErrorHandled = true;
      };

      downloadServerHelper(controller.downloadArtifact, saveToPath, (res) => {
        isErrorHandled.should.be.true();
        mockedRequest.db.models.artifact.find.calledOnce.should.be.true();
        mockedRequest.db.models.artifact.find.getCall(0).args[0].id.should.equal(1);

        should.not.exist(res.headers['content-disposition']);
        should.not.exist(res.headers['content-type']);

        done();
      });
    });
  });

  function getFileContents(fileName) {
    var contents, filepath = `${tmpdir}/${fileName}`;

    fs.existsSync(filepath).should.be.true();
    contents = fs.readFileSync(filepath, 'utf8');
    fs.unlinkSync(filepath);

    return contents;
  }

  function uploadServerHelper(handler, fileContents, onComplete) {
    serverHelper(handler, (err) => {
      should.not.exist(err);

      form = request
        .post('http://localhost:31415', (err, res) => {
          should.not.exist(err);
          onComplete(res);
        })
        .form();

      form.append('ignore_field', 'ignore_value');
      form.append('file', fileContents, {
        filename: 'testfile.txt',
        contentType: 'text/plain'
      });
    });
  }

  function downloadServerHelper(handler, saveToPath, onComplete) {
    serverHelper(handler, (err) => {
      should.not.exist(err);

      request('http://localhost:31415')
        .on('response', (response) => {
          response.pipe(fs.createWriteStream(saveToPath))
            .on('finish', () => {
              onComplete(response);
            });
        })
        .on('error', (err) => {
          should.not.exist(err);
        });
    });
  }

  function serverHelper(handler, onListening) {
    server = http
      .createServer((req, res) => {
        res.status = (status) => {
          res.statusCode = status;
          return res;
        };

        res.send = (payload) => {
          return res.end(JSON.stringify(payload));
        };

        _.extend(req, mockedRequest);
        handler(req, res, (err) => {
          // Ensure that if 'next' is called by the handler,
          // that we send a response.
          mockedNext(err);
          res.end();
        });
      })
      .listen(31415, onListening);
  }
});
