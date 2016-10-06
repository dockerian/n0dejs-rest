var orm = require('orm');

module.exports = function DeploymentModel(db) {
  var deployment = db.define('deployment', {
    deployment_id: {
      type: 'serial',
      key: true,
      required: false
    },
    build_id: {
      type: 'integer',
      required: true
    },
    created_date: {
      type: 'date',
      required: true,
      time: true
    },
    browseUrl: {
      type: 'text'
    },
    active: {
      type: 'boolean'
    }
  }, {
    methods: {
      serialize: function () {
        return {
          'deployment_id': this.deployment_id,
          'created_date': this.created_date,
          'browse_url': this.browseUrl,
          'build_id': this.build_id,
          'active': this.active
        };
      }
    }
  });

};
