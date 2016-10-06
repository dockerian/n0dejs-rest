var orm = require('orm');

module.exports = function BuildContainerModel(db) {
  db.define('build_container', {
    build_container_id: {
      type: 'serial',
      key: true,
      required: false
    },
    build_container_image_id: {
      type: 'integer',
      required: true
    },
    build_container_label: {
      type: 'text',
      required: true
    }
  });
};
