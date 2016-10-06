var orm = require('orm');

module.exports = function DeploymentTargetModel(db) {
  var deploymentTarget = db.define('deploymentTarget', {
    deployment_target_id: {
      type: 'serial',
      key: true,
      required: false
    },
    name: {
      type: 'text',
      required: true
    },
    type: {
      type: 'text',
      required: true
    },
    url: {
      type: 'text',
      encrypted: true
    },
    username: {
      type: 'text',
      encrypted: true
    },
    password: {
      type: 'text',
      encrypted: true,
      required: true
    },
    organization: {
      type: 'text'
    },
    space: {
      type: 'text'
    },
    skip_ssl_validation: {
      type: 'boolean'
    }
  }, {
    collection: 'deployment_target',
    validations: {
      name: [
          orm.validators.notEmptyString("The name must be set."),
          orm.validators.unique({
          scope: ['user_id']
        }, "The deployment target name must be unique.")
      ]
    },
    methods: {
      serialize: function () {
        return {
          deployment_target_id: this.deployment_target_id,
          user_id: this.user_id,
          type: this.type,
          url: this.url,
          username: this.username,
          password: this.password,
          name: this.name,
          organization: this.organization,
          space: this.space
        };
      }
    }
  });

};
