var _ = require('lodash'),
  assert = require('assert'),
  httpStatus = require('http-status-codes'),
  should = require('should'),
  sinon = require('sinon'),
  uuid = require('uuid'),
  utils = require('../utils'),
  controller = require('../app/v2/containers/images/controller.js');

describe('v2/containers/images/controller', () => {
  var testId;
  var mockedRequest, mockedResponse, mockedNext, mockedError;
  var mockedImage, mockedImages;

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
    mockedError = new Error('Mocked Error');

    mockedRequest = {
      logger: utils.logger.shim(utils.logger, testId = uuid.v1()),
      params: {
        image_id: 1
      },
      query: {},
      body: {
        image_label: 'image label',
        image_repo: 'image repo',
        image_tag: 'image tag',
        image_registry_id: 1,
        credential_id: 33
      },
      db: {
        models: {
          image: {
            all: sinon.stub(),
            get: sinon.stub(),
            create: sinon.stub(),
            remove: sinon.stub()
          }
        }
      }
    };

    mockedImage = {
      image_id: 1,
      remove: sinon.stub(),
      save: sinon.stub()
    };

    mockedImages = [
      mockedImage, {
        image_id: 1 + 1
      }
    ];

    mockedResponse = {
      send: sinon.stub(),
      status: sinon.stub()
    };

    mockedNext = sinon.stub();
  });

  describe('addImage', () => {
    it('should add an image', (done) => {
      mockedRequest.db.models.image.create.callsArgWith(1, null, mockedImage);
      mockedResponse.status.returns(mockedResponse);
      mockedResponse.send = (payload) => {
        mockedResponse.status.calledWith(httpStatus.CREATED);
        mockedResponse.status.calledOnce.should.be.true();
        payload.should.be.equal(mockedImage);
        done();
      };

      controller.addImage(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when addImage fails on ORM error', (done) => {
      mockedRequest.db.models.image.create.callsArgWith(1, null, null);
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no image');
        mockedRequest.db.models.image.create.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.addImage(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getImage', () => {
    it('should get an image', (done) => {
      mockedRequest.db.models.image.get.callsArgWith(1, null, mockedImage);
      mockedResponse.send = (payload) => {
        payload.should.be.equal(mockedImage);
        mockedRequest.db.models.image.get.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedNext.called.should.be.false();
        done();
      };

      controller.getImage(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getImage fails on ORM error', (done) => {
      mockedRequest.params.image_id = 1;
      mockedRequest.db.models.image.get.callsArgWith(1, null, null);
      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no image:1`);
        mockedRequest.db.models.image.get.calledWith(1);
        mockedResponse.status.called.should.be.false();
        mockedResponse.send.called.should.be.false();
        done();
      };

      controller.getImage(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('getImages', () => {
    it('should successfully get all images', (done) => {
      mockedRequest.db.models.image.all.callsArgWith(0, null, mockedImages);
      mockedResponse.send = (images) => {
        images.length.should.equal(mockedImages.length);
        images[0].image_id.should.equal(1);
        mockedNext.called.should.be.false();
        done();
      };

      controller.getImages(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getImages fails', (done) => {
      mockedRequest.db.models.image.all.callsArgWith(0, mockedError, null);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.getImages(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when getImages fails on ORM error', (done) => {
      mockedRequest.db.models.image.all.callsArgWith(0, null, null);
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no images');
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.getImages(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('removeImage', () => {
    it('should remove an image', (done) => {
      mockedImage.remove.callsArgWith(0, null);
      mockedRequest.db.models.image.get.callsArgWith(1, null, mockedImage);
      mockedResponse.status.returns(mockedResponse);
      mockedResponse.send = (payload) => {
        mockedNext.called.should.be.false();
        mockedResponse.status.calledWith(httpStatus.NO_CONTENT).should.be.true();
        assert.equal(payload, undefined);
        done();
      };

      controller.removeImage(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error with invalid image in request', (done) => {
      mockedRequest.db.models.image.get.callsArgWith(1, mockedError, null);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.removeImage(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error with ORM error on getting image', (done) => {
      mockedRequest.db.models.image.get.callsArgWith(1, null, null);
      mockedNext = (err) => {
        err.message.should.equal(`ORM returned no error, and no image:1`);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.removeImage(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when removeImage fails', (done) => {
      mockedImage.remove.callsArgWith(0, mockedError);
      mockedRequest.db.models.image.get.callsArgWith(1, null, mockedImage);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].message.should.equal(`${testId} : Removal for image with id '1' failed.`);
          done();
        });
      };

      controller.removeImage(mockedRequest, mockedResponse, mockedNext);
    });
  });

  describe('updateImage', () => {
    it('should update an image', (done) => {
      mockedImage.save.callsArgWith(0, null);
      mockedRequest.db.models.image.get.callsArgWith(1, null, mockedImage);
      mockedResponse.send = (payload) => {
        mockedNext.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        // image record should have been updated
        assert.equal(mockedImage.credential_id, mockedRequest.body.credential_id);
        assert.equal(mockedImage.image_registry_id, mockedRequest.body.image_registry_id);
        assert.equal(mockedImage.image_repo, mockedRequest.body.image_repo);
        assert.equal(mockedImage.image_label, mockedRequest.body.image_label);
        assert.equal(mockedImage.image_tag, mockedRequest.body.image_tag);
        payload.should.equal(mockedImage);
        done();
      };

      controller.updateImage(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error with invalid image in request', (done) => {
      mockedRequest.db.models.image.get.callsArgWith(1, mockedError, null);
      mockedNext = (err) => {
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.updateImage(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error with ORM error on getting image', (done) => {
      mockedRequest.db.models.image.get.callsArgWith(1, null, null);
      mockedNext = (err) => {
        err.message.should.equal('ORM returned no error, and no image:1');
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();
        done();
      };

      controller.updateImage(mockedRequest, mockedResponse, mockedNext);
    });

    it('should return an error when updateImage fails', (done) => {
      mockedImage.save.callsArgWith(0, mockedError);
      mockedRequest.db.models.image.get.callsArgWith(1, null, mockedImage);
      mockedNext = (err) => {
        var logMessage = `Saving updates to image 'image label' with id '1' failed.`;
        err.message.should.equal(mockedError.message);
        mockedResponse.send.called.should.be.false();
        mockedResponse.status.called.should.be.false();

        utils.logger.getEntriesForId(testId, (entries) => {
          entries[0].message.should.equal(`${testId} : Saving updates to image 'image label' with id '1' failed.`);
          done();
        });
      };

      controller.updateImage(mockedRequest, mockedResponse, mockedNext);
    });
  });
});
