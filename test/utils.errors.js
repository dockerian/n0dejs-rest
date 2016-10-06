var sinon = require('sinon'),
  should = require('should'),
  testHelpers = require('./_helpers.js'),
  utils = require('../utils');

describe('utils/errors', () => {

  describe('BadRequestError', () => {
    it('should be newable with no arguments', () => {
      var err = new utils.errors.BadRequestError();
      should.exist(err.message);
      err.message.should.equal('Bad Request');
    });

    it('should be newable with a set of arguments', () => {
      var err = new utils.errors.BadRequestError('name', 'description');
      should.exist(err.message);
      err.message.should.equal('Bad Request, the following properties were missing or invalid: name, description.');
    });

    it('should be newable with an array of arguments', () => {
      var err = new utils.errors.BadRequestError(['name', 'description']);
      should.exist(err.message);
      err.message.should.equal('Bad Request, the following properties were missing or invalid: name, description.');
    });

    it('should be a typeof Error', () => {
      var err = new utils.errors.BadRequestError();
      err.should.be.an.instanceof(Error);
      should.exist(err.stack);
    });

    it('should have 400 status', () => {
      var err = new utils.errors.BadRequestError();
      err.status.should.equal(400);
    });
  });

  describe('UnexpectedOrmError', () => {
    it('should be newable with no arguments', () => {
      var err = new utils.errors.UnexpectedOrmError();
      should.exist(err.message);
      err.message.should.equal('ORM behaved unexpectedly and didn\'t return an error.');
    });

    it('should be newable with a set of arguments', () => {
      var err = new utils.errors.UnexpectedOrmError(`project.id: ${3}`, `project.name: ${'goodProject'}`);
      should.exist(err.message);
      err.message.should.equal('ORM behaved unexpectedly and didn\'t return an error. Information: project.id: 3, project.name: goodProject.');
    });

    it('should be newable with an array of arguments', () => {
      var err = new utils.errors.UnexpectedOrmError([`project.id: ${3}`, `project.name: ${'goodProject'}`]);
      should.exist(err.message);
      err.message.should.equal('ORM behaved unexpectedly and didn\'t return an error. Information: project.id: 3, project.name: goodProject.');
    });

    it('should be a typeof Error', () => {
      var err = new utils.errors.UnexpectedOrmError();
      err.should.be.an.instanceof(Error);
      should.exist(err.stack);
    });

    it('should have 500 status', () => {
      var err = new utils.errors.UnexpectedOrmError();
      err.status.should.equal(500);
    });
  });
});
