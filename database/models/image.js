var orm = require('orm');

module.exports = function ImageModel(db) {
  db.define('image', {
    image_id: {
      type: 'serial',
      key: true,
      required: false
    },
    image_registry_id: {
      type: 'integer',
      required: true
    },
    image_repo: {
      type: 'text',
      required: true
    },
    image_label: {
      type: 'text',
      required: true
    },
    image_tag: {
      type: 'text',
      required: true
    }
  });
};
