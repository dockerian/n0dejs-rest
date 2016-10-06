var _ = require('lodash'),
  async = require('async'),
  fs = require('fs'),
  should = require('should'),
  actuators = require('../utils/actuators'),
  utils = require('../utils');

exports.refreshSettings = function refreshSettings() {
  delete require.cache[require.resolve('../utils/settings.js')];
  delete require.cache[require.resolve('../utils/system_images.js')];
  delete require.cache[require.resolve('../utils/concourse')];
  delete require.cache[require.resolve('../utils/vcs')];
  delete require.cache[require.resolve('../utils/actuators/pipelines')];
  utils.settings = require('../utils/settings.js');
  utils.vcs = require('../utils/vcs');
  utils.concourse = require('../utils/concourse');
  actuators.pipelines = require('../utils/actuators/pipelines');
};

exports.refreshConstants = function refreshConstants() {
  delete require.cache[require.resolve('../utils/constants.js')];
  utils.constants = require('../utils/constants.js');
};

exports.checkPipelineFile = function checkPipelineFile(pipelineId) {
  var filePath = `ignore_pipeline_${pipelineId}.yml`;

  try {
    return fs.statSync(filePath).isFile();
  } catch (err) {
    return false;
  }
};

exports.cleanUpPipelineFiles = function cleanUpPipelineFiles(done) {
  fs.readdir('.', (readdirErr, files) => {
    if (readdirErr) {
      console.warn(`cleanUpPipelineFiles: ${readdirErr}`);
      done();
    } else {
      async.each(
        files.filter(fileName => /^ignore_pipeline_.*\.yml$/.test(fileName)),
        deleteFile,
        done
      );
    }
  });

  function deleteFile(file, cb) {
    fs.unlink(file, (unlinkErr) => {
      if (unlinkErr) {
        console.warn(`cleanUpPipelineFiles: ${unlinkErr}`);
      }
      cb();
    });
  }
};

exports.compareCommandArgs = function compareCommandArgs(expectedArgs, actualArgs) {
  Object.keys(actualArgs).length.should.equal(Object.keys(expectedArgs).length);

  for (key in expectedArgs) {
    actualArgs[key].should.equal(expectedArgs[key]);
  }
}

exports.compareFilesByLinesSync = function compareFilesByLinesSync(expectedFilePath, actualFilePath) {
  try {
    // will throw if files don't exist
    fs.accessSync(expectedFilePath, fs.R_OK);
    fs.accessSync(actualFilePath, fs.R_OK);
  } catch (e) {
    should.fail('Required files did not exist for comparison.', e.message);
    return;
  }

  // uncomment this line to the command to update a baseline whenever the product behavior changes.
  // fs.writeFileSync(expectedFilePath, fs.readFileSync(actualFilePath, 'utf8'));
  var expectedFile = fs.readFileSync(expectedFilePath, 'utf8').split('\n');
  var actualFile = fs.readFileSync(actualFilePath, 'utf8').split('\n');

  actualFile.length.should.equal(expectedFile.length);

  _.each(expectedFile, (line, index) => {
    `line ${index}: ${actualFile[index]}`.should.equal(`line ${index}: ${line}`);
  });
}

exports.validateConcoursePipeline = function validateConcoursePipeline(command, fixturesDir, filePattern, cb) {
  var pipelineId;
  // This exec will be called for many 'fly' commands,
  // we only care about the actual uploading of the
  // pipeline so we can get the file and validate it.
  if (command.indexOf('fly set-pipeline') === 0) {
    var params, files;
    // compare the file
    files = command.match(/ignore_pipeline_[\w*-]*.yml/g);
    files.length.should.equal(1);
    exports.compareFilesByLinesSync(
      `${__dirname}/fixtures/${fixturesDir}/${filePattern}_pipeline_expect_result.yml`,
      files[0]
    );

    pipelineId = files[0].replace('ignore_pipeline_', '').replace('.yml', '');
  }

  return cb(pipelineId);
}

function extractSetPipelineCommandArgs(command) {
  // Extract the '--var key=value' from the command
  params = command.match(/--var \"\w*=(\w?[\/\s\.&$?%+:;><\-\_\']?)*\"/g);
  var commandVars = {};
  _.each(params, (param, index) => {
    var argPair = param
      .replace(/--var\s*/, '')
      .substring(1) // remove first "
      .split('=');
    argPair[1] = argPair[1].substring(0, argPair[1].length - 1); // remove trailing "

    commandVars[argPair[0]] = argPair[1];
  });

  return commandVars;
}
