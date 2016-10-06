 var _ = require('lodash'),
   httpStatus = require('http-status-codes'),
   multiparty = require('multiparty'),
   uuid = require('uuid'),
   actuators = require('../../../utils/actuators'),
   utils = require('../../../utils');



 //API document operationId: get_artifacts
 exports.getArtifacts = function getArtifacts(req, res, next) {
   var executionId = req.query.execution_id,
     findParams = {};

   if (!executionId) {
     return next(new Error('No execution id is passed.'));
   }
   req.logger.debug(`getting artifacts for execution id: '${executionId}'`);
   findParams.build_id = executionId;

   req.db.models.artifact.find(findParams, function withArtifacts(err, artifacts) {
     if (err || !artifacts) {
       err = err || new Error('ORM returned no error and no artifacts.');
       return next(err);
     }

     return res.send(artifacts);
   });
 };


 //API document operationId: get_artifact
 exports.getArtifact = function getArtifact(req, res, next) {
   var artifactId = req.params.artifact_id;
   req.logger.debug(`getting artifact with id '${artifactId}'`);
   req.db.models.artifact.get(artifactId, (err, artifact) => {
     if (!artifact || err) {
       err = err || new Error(`ORM returned no error, and no artifact with id:${artifactId}`);
       return next(err);
     }

     return res.send(artifact);
   });
 };


 //API document operationId: delete_artifact
 exports.deleteArtifact = function deleteArtifact(req, res, next) {
   var artifactId = req.params.artifact_id;
   req.logger.debug(`getting artifact with id: '${artifactId}' to remove`);
   req.db.models.artifact.get(artifactId, function withArtifact(err, artifact) {
     if (!artifact || err) {
       err = err || new Error(`ORM returned no error, and no artifact with id:${artifactId}`);
       return next(err);
     }

     // Remove record from database.
     req.logger.debug(`Removing artifact with id: '${artifactId}'`);
     artifact.remove((err) => {
       if (err) {
         req.logger.debug(`Removal of  artifact with id '${artifact.id}' failed.`);
         return next(err);
       }

       actuators.artifacts.deleteArtifactContent(artifact, req.logger);

       return res.status(httpStatus.NO_CONTENT).send();
     });
   });
 };


 //API document operationId: download_artifact
 exports.downloadArtifact = function downloadArtifact(req, res, next) {
   var artifactId = req.params.artifact_id,
     filePath,
     findParams = {
       'id': artifactId
     };
   req.logger.debug(`Downlaoding artifact with id: '${artifactId}'`);
   req.db.models.artifact.find(findParams, function withArtifact(err, artifacts) {
     if (!artifacts || artifacts.length !== 1 || err) {
       err = err || new Error(`ORM returned no error, and no artifact with id:${artifactId}`);
       return next(err);
     }

     actuators.artifacts.getArtifactContent(artifacts[0], req.logger, (err, artifactStream) => {
       if (err) {
         return next(err);
       }

       res.setHeader('Content-disposition', `attachment; filename=${artifacts[0].name}.log`);
       res.setHeader('Content-type', 'text/plain');

       artifactStream
         .on('error', (err) => {
           req.logger.warn(`Error reading artifact stream ${artifacts[0].name}: ${err.message}`);
         })
         .pipe(res)
         .on('error', (err) => {
           req.logger.warn(`Error sending artifact stream ${artifacts[0].name}: ${err.message}`);
         });
     });
   });
 };


 //API document operationId: upload_artifact
 exports.uploadArtifact = function uploadArtifact(req, res, next) {
   var form = new multiparty.Form(),
     newArtifact = {
       name: `${req.query.artifact_type}_${uuid.v4()}`,
       type: req.query.artifact_type,
       build_id: req.query.execution_id,
       createdDate: new Date(Date.now())
     };

   form.on('part', (part) => { 
     if (!part.filename) {
       return part.resume();
     }

     actuators.artifacts.createArtifact(newArtifact, part, req.logger, sendResponse);
   });

   form.on('error', (err) => {
     req.logger.error(`Processing form for artifact ${newArtifact.name} failed.`);
     return next(err);
   });

   try {
     form.parse(req);
   } catch (e) {
     return next(e);
   }

   function sendResponse(err, artifact) {
     if (err) {
       return next(err);
     }

     return res.status(httpStatus.CREATED).send(artifact);
   }
 };
