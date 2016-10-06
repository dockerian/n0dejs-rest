var sinon = require('sinon'),
  should = require('should'),
  _ = require('lodash'),
  rewire = require('rewire'),
  utils = require('../utils'),
  testHelpers = require('./_helpers.js');

describe('control-plane/sdk/settings', () => {
  process.env = {};

  before(() => {
    process.env = {
      CONCOURSE_ENDPOINT: "http://concourseHost:1234/",
      API_REST_SERVICE_HOST: '444.444.444.444',
      PUBLIC_API_URL: 'https://api.n0dejs.com/v2/',
      API_HOST: 'n0dejs-api',
      DEBUG: 'TRUE'
    };

    testHelpers.refreshSettings();
  });

  after(() => {
    testHelpers.refreshSettings();
  });

  it('Should set privateUri from API_HOST env variable', () => {
    utils.settings.crest.privateUri.should.equal('https://n0dejs-api/v2')
  });

  it('Should set debug from DEBUG env variable', () => {
    utils.settings.debug.should.equal(true)
  });

  it('Should set publicUri from PUBLIC_API_URL env variable', () => {
    utils.settings.crest.publicUri.should.equal('https://api.n0dejs.com/v2')
  });

  it('Should set publicUri from LB_REST_HTTPS env variable when set', () => {
    process.env.LB_REST_HTTPS = 'someurl:31337';
    testHelpers.refreshSettings();
    utils.settings.crest.publicUri.should.equal('https://someurl:31337/v2');
    delete process.env.LB_REST_HTTPS;
    testHelpers.refreshSettings();
  });

  it('Should set publicUri from LB_REST_HTTP env variable when set', () => {
    process.env.LB_REST_HTTP = 'someurl:31337';
    testHelpers.refreshSettings();
    utils.settings.crest.publicUri.should.equal('http://someurl:31337/v2');
    delete process.env.LB_REST_HTTP;
    testHelpers.refreshSettings();
  });

  it('Should set concourseUri from CONCOURSE_ENDPOINT env variable', () => {
    utils.settings.concourse.apiUrl.should.equal('http://concourseHost:1234/')
  });

  it('Should calculate WATCHDOG_INTERVAL value', () => {
    process.env = {
      WATCHDOG_INTERVAL: 50
    };

    testHelpers.refreshSettings();
    utils.settings.watchdog.interval.should.be.equal(50 * 1000)
  });

  it('Should set crest public Uri from REST_PORT invalid URI, env variable', () => {
    process.env = {
      API_REST_SERVICE_HOST: '444.444.444.444',
      REST_PORT: 'THISISNOTANURI'
    };

    testHelpers.refreshSettings();
    utils.settings.crest.publicUri.should.equal('http://unknown/v2')
  });

  it('Should set publicUri from REST_PORT when there is no port', () => {
    delete process.env.LB_REST_HTTPS;
    delete process.env.PUBLIC_API_URL;
    process.env.REST_PORT = 'tcp://444.444.444.444';
    testHelpers.refreshSettings();
    utils.settings.crest.publicUri.should.equal('https://444.444.444.444/v2')
  });


  it('Should set publicUri from REST_PORT if PUBLIC_API_URL is not set', () => {
    process.env.REST_PORT = 'tcp://444.444.444.444:3001';
    testHelpers.refreshSettings();
    utils.settings.crest.publicUri.should.equal('https://444.444.444.444:3001/v2')
  });

  it('Should set uaaURI from HCP_IDENTITY_HOST', () => {
    delete process.env.HCP_IDENTITY_HOST;
    process.env = {
      HCP_IDENTITY_SCHEME: "http",
      HCP_IDENTITY_HOST: "UAA_HOST_NAME"
    };

    testHelpers.refreshSettings();

    utils.settings.auth.endpoint.should.equal('http://UAA_HOST_NAME')
  });

  it('Should set uaaURI from HCP_IDENTITY_HOST, and HCP_IDENTITY_PORT', () => {
    delete process.env.HCP_IDENTITY_HOST;
    process.env = {
      HCP_IDENTITY_SCHEME: "http",
      HCP_IDENTITY_HOST: "UAA_HOST_NAME",
      HCP_IDENTITY_PORT: 8090
    };

    testHelpers.refreshSettings();

    utils.settings.auth.endpoint.should.equal('http://UAA_HOST_NAME:8090')
  });

  it('Should set uaaURI from HCP_IDENTITY_EXTERNAL_HOST, and HCP_IDENTITY_EXTERNAL_PORT', () => {
    // ubuntu@ip-10-0-1-95:~$ docker exec -it b786aba61b26 env | grep -i ident
    // HCP_IDENTITY_SCHEME=http
    // HCP_IDENTITY_HOST=ident-api.hcp.svc.cluster.hcp
    // HCP_IDENTITY_PORT=8080
    // HCP_IDENTITY_EXTERNAL_HOST=a1385e044479711e69d31021a4b657f7-1294267383.us-west-1.elb.amazonaws.com
    // HCP_IDENTITY_EXTERNAL_PORT=8080
    delete process.env.HCP_IDENTITY_EXTERNAL_HOST;
    process.env = {
      HCP_IDENTITY_HOST: "ident-api.hcp.svc.cluster.hcp",
      HCP_IDENTITY_SCHEME: "http",
      HCP_IDENTITY_EXTERNAL_HOST: "EXTERNAL_UAA_HOST_NAME",
      HCP_IDENTITY_EXTERNAL_PORT: 4143,
      HCP_IDENTITY_PORT: 8090
    };

    testHelpers.refreshSettings();

    utils.settings.auth.endpoint.should.equal('http://EXTERNAL_UAA_HOST_NAME:4143')
  });

  it('Should set uaaURI from HCP_IDENTITY_EXTERNAL_HOST, HCP_INSTANCE_ID, and HCP_IDENTITY_EXTERNAL_PORT', () => {
    delete process.env.HCP_IDENTITY_EXTERNAL_HOST;
    process.env = {
      HCP_INSTANCE_ID: "chickens",
      HCP_IDENTITY_HOST: "ident-api.hcp.svc.cluster.hcp",
      HCP_IDENTITY_SCHEME: "http",
      HCP_IDENTITY_EXTERNAL_HOST: "EXTERNAL_UAA_HOST_NAME",
      HCP_IDENTITY_EXTERNAL_PORT: 4143,
      HCP_IDENTITY_PORT: 8090
    };

    testHelpers.refreshSettings();

    utils.settings.auth.endpoint.should.equal('http://chickens.EXTERNAL_UAA_HOST_NAME:4143')
    delete process.env.HCP_INSTANCE_ID;
    delete process.env.HCP_IDENTITY_HOST;
    delete process.env.HCP_IDENTITY_SCHEME;
    delete process.env.HCP_IDENTITY_EXTERNAL_HOST;
    delete process.env.HCP_IDENTITY_PORT;
  });

  it('Should set uaaURI to unset', () => {
    delete process.env.HCP_IDENTITY_HOST;
    process.env = {};

    testHelpers.refreshSettings();

    utils.settings.auth.endpoint.should.equal('')
  });

  it('Should get the hostname if not port is provided in getHostPort', () => {
    process.env.REGISTRY_MIRROR = 'http://somehost/'
    testHelpers.refreshSettings();

    utils.settings.concourse.registryMirrorHostPort.should.equal('somehost');
  });

  it("Should load certificates for service", () => {
    var settingsM = rewire('../utils/settings');
    var mockedFS = {
      readFileSync: sinon.stub().returns('')
    };

    settingsM.__set__('fs', mockedFS);
    settingsM.loadCerts();
    testHelpers.refreshSettings();
  });

  it("Should set new system configurations", (done) => {
    var mockConnection = {
      models: {
        system_configuration: {
          create: sinon.stub().callsArgWith(1, null),
          save: sinon.stub().callsArgWith(0, null),
          find: sinon.stub().callsArgWith(1, null, [])
        }
      }
    };

    utils.database.connection = sinon.stub().callsArgWith(0, null, mockConnection);

    utils.settings.setSystemConfigurationValue('testKey', '1', (error) => {
      should.equal(error, null);
      done();
    });
  });

  it("Should update system configurations", (done) => {
    var result = {
        value: '0',
        save: sinon.stub().callsArgWith(0, null)
      },
      mockConnection = {
        models: {
          system_configuration: {
            create: sinon.stub().callsArgWith(1, null),
            save: sinon.stub().callsArgWith(0, null),
            find: sinon.stub().callsArgWith(1, null, [result])
          }
        }
      };

    utils.database.connection = sinon.stub().callsArgWith(0, null, mockConnection);

    utils.settings.setSystemConfigurationValue('testKey', '1', (error) => {
      should.equal(error, null);
      done();
    });
  });

  it("Should fail to set a system configuration when the database connection errors", (done) => {
    utils.database.connection = sinon.stub().callsArgWith(0, new Error("Database connection failed"));

    utils.settings.setSystemConfigurationValue('testKey', '1', (error) => {
      error.should.not.equal(null);
      error.message.should.equal("Database connection failed");
      done();
    });
  });

  it("Should update system configurations", (done) => {
    var mockConnection = {
      models: {
        system_configuration: {
          find: sinon.stub().callsArgWith(1, new Error('Find failed'))
        }
      }
    };

    utils.database.connection = sinon.stub().callsArgWith(0, null, mockConnection);

    utils.settings.setSystemConfigurationValue('testKey', '1', (error) => {
      error.should.not.equal(null);
      error.message.should.equal('Find failed');
      done();
    });
  });

  it("Should get a system configuration value", (done) => {
    var result = {
        value: '0'
      },
      mockConnection = {
        models: {
          system_configuration: {
            find: sinon.stub().callsArgWith(1, null, [result])
          }
        }
      };
    utils.database.connection = sinon.stub().callsArgWith(0, null, mockConnection);

    utils.settings.getSystemConfigurationValue('test', (error, results) => {
      should.equal(error, null);
      results.should.equal('0');
      done();
    });
  });

  it("Should fail to get a system configuration when the database connection errors", (done) => {
    utils.database.connection = sinon.stub().callsArgWith(0, new Error("Database connection failed"));

    utils.settings.getSystemConfigurationValue('testKey', (error) => {
      error.should.not.equal(null);
      error.message.should.equal("Database connection failed");
      done();
    });
  });
});
