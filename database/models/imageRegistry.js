var orm = require('orm');

module.exports = function ImageRegistryModel(db) {
  db.define('image_registry', {
    image_registry_id: {
      type: 'serial',
      key: true,
      required: false
    },
    registry_url: {
      type: 'text',
      required: true
    },
    registry_label: {
      type: 'text',
      required: true
    },
    skip_ssl_validation: {
      type: 'boolean'
    }
  }, {
    methods: {
      serialize: function () {
        return this;
      }
    }
  });
};
