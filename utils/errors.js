'use strict'

var _ = require('lodash'),
  httpStatus = require('http-status-codes');

/**
 * BadRequestError
 * Used in validation of requests and objects on put/push requests.
 *
 * Accepts either a single argument that is an array of strings,
 * or a set of arguments where each is a string. The strings
 * aught to be the names of properties that were invalid.
 *
 * Optionally accepts 2 arguments, the first a bad property name,
 * and the second a sentence explaining details about the property.
 */
class BadRequestError extends Error {
  constructor() {
    var message = 'Bad Request',
      details = '',
      badProperties = [];

    // check if we were given a single array, or individual args
    if (arguments.length === 1 && arguments[0] instanceof Array) {
      badProperties = arguments[0];
    } else if (arguments.length > 0) {
      badProperties = _.toArray(arguments);
    }

    // check to see if we were given a property and a message, or just an list of bad properties.
    if (badProperties.length !== 0) {
      if (badProperties.length === 2 && badProperties[1].indexOf(' ') !== -1) {
        message = `Bad Request, the following properties were missing or invalid: ${badProperties[0]}.`
        details = badProperties[1];
      } else {
        message = `Bad Request, the following properties were missing or invalid: ${badProperties.join(', ')}.`;
      }
    }

    super(message);
    this.name = this.constructor.name;
    this.status = httpStatus.BAD_REQUEST;
    this.message = message;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * UnexpectedOrmError
 * Used in in the callback for ORM queries when the results are unexpected.
 *
 * Accepts either a single argument that is an array of strings,
 * or a set of arguments where each is a string. The strings aught
 * to be information about the query which behaved unexpectedly.
 */
class UnexpectedOrmError extends Error {
  constructor() {
    var message = 'ORM behaved unexpectedly and didn\'t return an error.',
      queryInfo = [];

    if (arguments.length === 1 && arguments[0] instanceof Array) {
      queryInfo = arguments[0];
    } else if (arguments.length > 0) {
      queryInfo = _.toArray(arguments);
    }

    if (queryInfo.length !== 0) {
      message = `${message} Information: ${queryInfo.join(', ')}.`;
    }

    super(message);
    this.name = this.constructor.name;
    this.status = httpStatus.INTERNAL_SERVER_ERROR;
    this.message = message;

    Error.captureStackTrace(this, this.constructor);
  }
}

exports.BadRequestError = BadRequestError;
exports.UnexpectedOrmError = UnexpectedOrmError;
