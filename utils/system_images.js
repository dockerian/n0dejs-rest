var database = require('../utils/database'),
  _ = require('lodash'),
  async = require('async'),
  systemImages = [];

exports.loadImages = function loadSystemImages(done) {
  var missingImages = [];
  async.waterfall([
    database.connection,
    findSystemImages,
    setSystemImages
  ], done);

  function findSystemImages(connection, callback) {
    connection.driver.execQuery("SELECT * FROM image " +
      "LEFT JOIN credential ON image.credential_id=credential.credential_id " +
      "INNER JOIN image_registry ON image.image_registry_id=image_registry.image_registry_id " +
      "WHERE image.image_label LIKE 'foo_system%'", (err, images) => {
        return callback(err, images);
      });
  }

  function setSystemImages(images, callback) {
    var imageLookup = {},
      newImages = {};

    _.each(images, (image) => {
      // Convert an array of objects into an object with the label as the property name.
      // e.g. Convert
      // [
      //   {
      //     image_repo: 'foobar/git-merge-worker',
      //     image_tag: 'kosher-prod',
      //     image_label: 'foo_system_gitmerge'
      //   }
      // ]
      // into :
      // {
      //   foo_system_gitmerge: {
      //     image_repo: 'foobar/git-merge-worker',
      //     image_tag: 'kosher-prod',
      //     image_label: 'foo_system_gitmerge'
      //   }
      // }
      imageLookup[image.image_label] = formatImageRow(JSON.parse(JSON.stringify(image)));
    });

    function formatImageRow(imageRow) {
      // When the query returns, it returns an object with the
      // properties for the credential object flattened.
      // We convert the flattened credential properties to an object
      // and set it as the 'credental' property on the imageRow
      if (imageRow.credential_id && imageRow.credential_id >= 0) {
        imageRow.credential = _.pick(imageRow, 'credential_id',
          'credential_type_id', 'credential_key',
          'credential_value', 'credential_extra');
      };

      imageRow.image_registry = _.pick(imageRow, 'image_registry_id', 'registry_url', 'registry_label');

      // Remove the properties so the credentials are only available via the 'credential'
      // property on the imageRow.
      delete imageRow.credential_id;
      delete imageRow.credential_type_id;
      delete imageRow.credential_key;
      delete imageRow.credential_value;
      delete imageRow.credential_extra;
      return imageRow;
    }

    function assertSystemImageExists(lookup, imageName) {
      var credential,
        credentialProperties = ["credential_key", "credential_value", "credential_extra"];
      if (lookup[imageName]) {
        credential = lookup[imageName].credential;
        if (credential) {
          for (var index = 0; index < credentialProperties.length; index++) {
            var property = credentialProperties[index];
            if (credential[property]) {
              credential[property] = database.connection.decryptValue(credential[property]);
            }
          }
        }
      } else {
        missingImages.push(imageName);
      }

      return lookup[imageName];
    }

    newImages = {
      workers: {
        gitMerge: assertSystemImageExists(imageLookup, "foo_system_gitmerge"),
        stormRunner: assertSystemImageExists(imageLookup, "foo_system_stormrunner"),
        cloudFoundry: assertSystemImageExists(imageLookup, "foo_system_cloudfoundry")
      },
      notifiers: {
        buildEvent: assertSystemImageExists(imageLookup, "foo_system_buildevent"),
        hipchat: assertSystemImageExists(imageLookup, "foo_system_hipchat"),
        http: assertSystemImageExists(imageLookup, "foo_system_http"),
        githubpullrequest: assertSystemImageExists(imageLookup, "foo_system_githubpullrequest"),
        bitbucketpullrequest: assertSystemImageExists(imageLookup, "foo_system_bitbucketpullrequest"),
        flowdock: assertSystemImageExists(imageLookup, "foo_system_flowdock"),
        slack: assertSystemImageExists(imageLookup, "foo_system_slack")
      }
    };

    systemImages = newImages;
    if (missingImages.length > 0) {
      return callback(new Error(`Unable to load the following system images : ${missingImages.join(', ')}`));
    }

    return callback();
  }
}

exports.images = function getImages() {
  return systemImages;
};
