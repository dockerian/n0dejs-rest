var _ = require('lodash'),
  fs = require('fs'),
  path = require('path'),
  stream = require('stream'),
  utils = require('../../utils');

exports.createArtifact = function createArtifact(newArtifact, contents, logger, done) {
  var filePath = path.join(utils.settings.storage.containerPath, newArtifact.name);

  logger = utils.logger.shim(logger, 'CreateArtifact');

  if (contents instanceof stream.Stream) {
    var fsStream;
    // If its coming over the network it may be a stream
    logger.info(`Begin writing '${newArtifact.name}' to disk.`);

    try {
      fsStream = fs.createWriteStream(filePath);
    } catch (err) {
      logger.error(`Unable to create filestream for file '${filePath}'`, err);
      return done(err);
    }

    return contents.pipe(fsStream)
      .on('error', (err) => {
        logger.error(`Unable to stream file '${newArtifact.name}' to disk: ${err.message}`);
      })
      .on('error', done)
      .on('finish', () => {
        logger.info(`Completed writing '${newArtifact.name}' to disk.`);
      })
      .on('finish', addDatabaseEntry);
  } else if (typeof contents === 'string') {
    // If its coming from the watchdog, it may be a string
    logger.info(`Begin writing '${newArtifact.name}' to disk.`);
    fs.writeFile(filePath, contents, (err) => {
      if (err) {
        logger.error(`Unable to save file '${newArtifact.name}' to disk: ${err.message}`);
        return done(err);
      }

      logger.info(`Completed writing '${newArtifact.name}' to disk.`);
      addDatabaseEntry();
    });
  }

  function addDatabaseEntry() {
    utils.database.connection((err, connection) => {
      if (err) {
        logger.debug('Could not establish connection to save artifact.');
        return unlink(err);
      }

      return connection.models.artifact.create(newArtifact, function withArtifact(err, artifact) {
        if (!artifact || err) {
          err = err || new Error(`ORM returned no error, and no created artifact for execution id: ${newArtifact.build_id}`);
          return unlink(err);
        }

        return done(null, artifact);
      });

      function unlink(err) {
        // Ensure that the database and the disk are in sync, and we don't leak files.
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr) {
            logger.error(`Delete for container '${filePath}' failed. The file has leaked.`, unlinkErr);
          }

          return done(err);
        });
      }
    });
  }
}

exports.getArtifactContent = function getArtifactContent(artifact, logger, done) {
  var fileStream, filePath;

  filePath = path.join(utils.settings.storage.containerPath, artifact.name);
  logger = utils.logger.shim(logger, 'GetArtifactContent');

  fs.lstat(filePath, (err, exists) => {
    if (err) {
      logger.error(`Unable to locate file on disk with path: ${filePath}`, err);
      return done(err);
    }

    logger.info(`Begin streaming file from disk: ${artifact.name}`);

    fileStream = fs
      .createReadStream(filePath)
      .on('error', (err) => {
        logger.error(`Error streaming file from disk: ${artifact.name}`, err);
      })
      .on('finish', () => {
        logger.info(`Finished streaming file from disk: ${artifact.name}`);
      });

    return done(null, fileStream);
  });
}

exports.deleteArtifactContent = function deleteArtifactContent(artifact, logger, done) {
  var filePath = path.join(utils.settings.storage.containerPath, artifact.name);

  logger = utils.logger.shim(logger, 'DeleteArtifactContent');
  logger.info(`Removing file from disk: ${artifact.name}`);

  // Remove the file from disk. If it fails, log a warning.
  fs.unlink(filePath, (err) => {
    if (err) {
      logger.error(`Delete for container '${filePath}' failed. The file may have leaked.`, err);
    }

    if (done) {
      return done(err);
    }
  });
}
