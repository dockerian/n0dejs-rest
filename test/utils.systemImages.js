var sinon = require('sinon'),
  should = require('should'),
  _ = require('lodash'),
  rewire = require('rewire'),
  systemImages = rewire('../utils/system_images.js'),
  systemImagesQueryResult = require('./system_images_query_result.json');

describe('utils/system_images', () => {
  var mockedDB, mockDecryptValue;

  beforeEach(() => {
    mockedDB = {};
    foo_system_images = {};
    mockedDB.driver = {
      execQuery: sinon.stub().callsArgWith(1, null, systemImagesQueryResult)
    };

    mockDecryptValue = sinon.stub().returns("Decrypted")
    mockedDB.connection = sinon.stub().callsArgWith(0, null, mockedDB);
    mockedDB.connection.decryptValue = mockDecryptValue;
    systemImages.__set__('database', mockedDB);
  });

  it("Can load system images", (done) => {
    systemImages.loadImages(() => {
      mockedDB.driver.execQuery
        .calledWith("SELECT * FROM image " +
          "LEFT JOIN credential ON image.credential_id=credential.credential_id " +
          "INNER JOIN image_registry ON image.image_registry_id=image_registry.image_registry_id " +
          "WHERE image.image_label LIKE 'foo_system%'")
        .should.be.true();

      should.exist(systemImages.images());
      var workers = systemImages.images().workers,
        notifiers = systemImages.images().notifiers;

      for (var worker in workers) {
        validateImageInstance(workers[worker], true);
      }

      for (var notifier in notifiers) {
        validateImageInstance(notifiers[notifier], notifier !== "slack");
      }
      done();
    });
  });

  it("Can decrypt credentials on system images", (done) => {
    var queryResult = [
      {
        "image_id": 7,
        "image_registry_id": 3,
        "image_repo": "foobar/git-merge-worker",
        "image_tag": "kosher-prod",
        "image_label": "foo_system_gitmerge",
        "credential_id": 1,
        "credential_type_id": 1,
        "credential_key": "dockerhub_user",
        "credential_value": "dockerhub_password",
        "credential_extra": "dockerhub_user@email.com",
        "owner_id": null,
        "label": null,
        "created": "0000-00-00 00:00:00",
        "modified": "2016-07-15T23:04:12.000Z",
        "registry_url": "https://docker.foobar.space",
        "registry_label": "foo_system_registry"
      }
    ];

    mockedDB.driver.execQuery = sinon.stub().callsArgWith(1, null, queryResult);

    systemImages.loadImages(() => {
      mockedDB.driver.execQuery
        .calledWith("SELECT * FROM image " +
          "LEFT JOIN credential ON image.credential_id=credential.credential_id " +
          "INNER JOIN image_registry ON image.image_registry_id=image_registry.image_registry_id " +
          "WHERE image.image_label LIKE 'foo_system%'")
        .should.be.true();

      should.exist(systemImages.images());

      mockDecryptValue.calledWith('dockerhub_user').should.be.true();
      mockDecryptValue.calledWith('dockerhub_password').should.be.true();
      mockDecryptValue.calledWith('dockerhub_user@email.com').should.be.true();
      done();
    });
  });

  it("Should fail if cannot load system images", (done) => {
    mockedDB.driver.execQuery.callsArgWith(1, null, []);
    systemImages.loadImages((error) => {
      should.exist(error);
      error.message.should.be.equal(`Unable to load the following system images : foo_system_gitmerge, ` +
        `foo_system_stormrunner, foo_system_cloudfoundry, foo_system_buildevent, foo_system_hipchat, ` +
        `foo_system_http, foo_system_githubpullrequest, foo_system_bitbucketpullrequest, ` +
        `foo_system_flowdock, foo_system_slack`);
      done();
    });
  });
});

function validateImageInstance(imageInstance, credentialsExist) {
  should.exist(imageInstance.image_id, "Image ID");
  should.exist(imageInstance.image_registry_id, "Image registry ID");
  should.exist(imageInstance.image_repo, "image repo");
  should.exist(imageInstance.image_tag, "image tag");
  should.exist(imageInstance.image_label, "image label");

  should.exist(imageInstance.image_registry)

  imageInstance.image_registry.image_registry_id.should.be.equal(3, "registry id");
  imageInstance.image_registry.registry_url.should.be.equal("https://docker.foobar.space", 'registry url');
  imageInstance.image_registry.registry_label.should.be.equal("foo_system_registry", 'registry label');
  if (credentialsExist) {
    should.exist(imageInstance.credential, "Credential");
    should.exist(imageInstance.credential.credential_id, "Credential id");
    should.exist(imageInstance.credential.credential_type_id, "credential_type_id");
    should.exist(imageInstance.credential.credential_key, "credential_key");
    should.exist(imageInstance.credential.credential_value, "credential_value");
    should.exist(imageInstance.credential.credential_extra, "credential_extra");
  } else {
    should.not.exist(imageInstance.credential, "credential should not exist");
  }
}
