var _ = require('lodash'),
  assert = require('assert'),
  httpStatus = require('http-status-codes'),
  should = require('should'),
  sinon = require('sinon'),
  uuid = require('uuid'),
  utils = require('../utils'),
  controller = require('../app/v2/containers/images/registries/controller.js');

describe('v2/containers/images/registries/controller', () => {
  var testId;
  var mockedRequest, mockedResponse, mockedNext, mockedError;
  var mockedRegistry, mockedRegistries, mockedRegistryId = 1;

  before(() => {
    // Silence all but the buffer, we need to peek the logs for validation.
    _.each(Object.keys(utils.logger.transports), (transportType) => {
      if (transportType === 'buffer') {
        utils.logger.transports[transportType].level = 'debug';
      } else {
        utils.logger.transports[transportType].level = 'silent';
      }
    });

    utils.database.connection.encryptValue = (value) => {
      return `encrypted_${value}`;
    };
  });

  beforeEach(() => {
    mockedRequest = {
      logger: utils.logger.shim(utils.logger, testId = uuid.v1()),
      params: {
        registry_id: mockedRegistryId
      },
      query: {},
      body: {
        registry_url: 'http://registry.url',
        registry_label: 'registry label'
      },
      db: {
        models: {
          image_registry: {
            all: sinon.stub(),
            get: sinon.stub(),
            create: sinon.stub(),
            remove: sinon.stub()
          }
        }
      }
    };

    mockedRegistry = {
      image_registry_id: mockedRegistryId,
      remove: sinon.stub(),
      save: sinon.stub()
    };

    mockedRegistries = [
      mockedRegistry, {
        image_registry_id: mockedRegistryId + 1
      }
    ];

    mockedResponse = {
      send: sinon.stub(),
      status: sinon.stub()
    };

    mockedNext = sinon.stub();
    mockedError = new Error('Mocked Error');
  });

  describe('addImageRegistry', () => {
    it('should add an image registry', (done) => {
      mockedRequest.db.models.image_registry.create.callsArgWith(1, null, mockedRegistry);
      mockedResponse.status.returns(mockedResponse);
      mockedResponse.send = (payload) => {
        mockedResponse.status.calledWith(httpStatus.CREATED);
        mockedResponse.status.calledOnce.should.be.true();
        payload.should.be.equal(mockedRegistry);
        done();
      };

      controller.addImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when addImageRegistry fails on ORM error', (done) => {
      mockedRequest.db.models.image_registry.create.callsArgWith(1, null, null);
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no image registry');
        mockedRequest.db.models.image_registry.create.calledWith(mockedRegistryId);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.addImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getImageRegistry', () => {
    it('should get an image registry', (done) => {
      mockedRequest.db.models.image_registry.get.callsArgWith(1, null, mockedRegistry);
      mockedResponse.send = (payload) => {
        payload.should.be.equal(mockedRegistry);
        mockedRequest.db.models.image_registry.get.calledWith(mockedRegistryId);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        done();
      };

      controller.getImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getImageRegistry fails on ORM error', (done) => {
      mockedRequest.params.registry_id = mockedRegistryId;
      mockedRequest.db.models.image_registry.get.callsArgWith(1, null, null);
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no image registry:1');
        mockedRequest.db.models.image_registry.get.calledWith(mockedRegistryId);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getImageRegistries', () => {
    it('should successfully get all image registries', (done) => {
      mockedRequest.db.models.image_registry.all.callsArgWith(0, null, mockedRegistries);
      mockedResponse.send = (image_registries) => {
        image_registries.length.should.equal(mockedRegistries.length);
        image_registries[0].image_registry_id.should.equal(mockedRegistryId);
        mockedNext.called.should.be.false();
        done();
      };

      controller.getImageRegistries(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getImageRegistries fails', (done) => {
      mockedRequest.db.models.image_registry.all.callsArgWith(0, mockedError, null);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.getImageRegistries(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getImageRegistries fails on ORM error', (done) => {
      mockedRequest.db.models.image_registry.all.callsArgWith(0, null, null);
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no image registries');
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.getImageRegistries(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('removeImageRegistry', () => {
    it('should remove an image registry', (done) => {
      mockedRegistry.remove.callsArgWith(0, null);
      mockedRequest.db.models.image_registry.get.callsArgWith(1, null, mockedRegistry);
      mockedResponse.status.returns(mockedResponse);
      mockedResponse.send = (payload) => {
        mockedNext.called.should.be.false();
        mockedResponse.status.calledWith(httpStatus.NO_CONTENT).should.be.true();
        assert.equal(payload, undefined);
        done();
      };

      controller.removeImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error with invalid image registry in request', (done) => {
      mockedRequest.db.models.image_registry.get.callsArgWith(1, mockedError, null);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.removeImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error with ORM error on getting image registry', (done) => {
      mockedRequest.db.models.image_registry.get.callsArgWith(1, null, null);
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no image registry:1');
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.removeImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when removeImageRegistry fails', (done) => {
      mockedRegistry.remove.callsArgWith(0, mockedError);
      mockedRequest.db.models.image_registry.get.callsArgWith(1, null, mockedRegistry);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].message.should.equal(`${testId} : Removal for image registry with id '1' failed.`);
          done();
        });
      };

      controller.removeImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('updateImageRegistry', () => {
    it('should update an image registry', (done) => {
      mockedRegistry.save.callsArgWith(0, null);
      mockedRequest.db.models.image_registry.get.callsArgWith(1, null, mockedRegistry);
      mockedResponse.send = (payload) => {
        mockedNext.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        // image registry record should have been updated
        assert.equal(mockedRegistry.registry_label, mockedRequest.body.registry_label);
        assert.equal(mockedRegistry.registry_url, mockedRequest.body.registry_url);
        payload.should.equal(mockedRegistry);
        done();
      };

      controller.updateImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error with invalid image registry in request', (done) => {
      mockedRequest.db.models.image_registry.get.callsArgWith(1, mockedError, null);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.updateImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error with ORM error on getting image registry', (done) => {
      mockedRequest.db.models.image_registry.get.callsArgWith(1, null, null);
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no image registry:1');
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.updateImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when updateImageRegistry fails', (done) => {
      mockedRegistry.save.callsArgWith(0, mockedError);
      mockedRequest.db.models.image_registry.get.callsArgWith(1, null, mockedRegistry);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].message.should.equal(`${testId} : Saving updates to image registry 'registry label' with id '1' failed.`);
          done();
        });
      };

      controller.updateImageRegistry(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
