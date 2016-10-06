var _ = require('lodash'),
  winston = require('winston'),
  winston_cbuff = require('winston-circular-buffer'),
  logger;

winston.emitErrs = true;
var logLevel = process.env.LOGLEVEL || 'debug';

module.exports = logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: logLevel,
      handleExceptions: true,
      humanReadableUnhandledException: true,
      json: false,
      colorize: false
    }),
    new winston.transports.CircularBuffer({
      name: 'buffer',
      level: logLevel,
      json: true,
      size: 100
    })
  ],
  exitOnError: false
});

module.exports.stream = {
  write: (message, encoding) => {
    logger.info(message);
  }
};

module.exports.shim = function shim(logger, shimText) {
  function writeTo(type) {
    return function () {
      arguments[0] = `${shimText} : ${arguments[0]}`;
      logger[type].apply(logger, arguments);
    }
  }

  return {
    log: writeTo('log'),
    info: writeTo('info'),
    warn: writeTo('warn'),
    error: writeTo('error'),
    debug: writeTo('debug')
  };
};

module.exports.getEntriesForId = function getEntriesForId(requestId, callback) {
  // make this asynchronous.
  setTimeout(() => {
    logger.query({
      json: true,
      order: 'asc'
    }, (err, entries) => {
      if (err) {
        logger.error(err);
        entries = [];
      }

      return callback(_.filter(entries['buffer'], (entry) => {
        return (
          entry &&
          entry.message &&
          entry.message.indexOf(requestId) !== -1);
      }));
    });
  }, 0);
};
