var orm = require('orm');

module.exports = function VcsTypeModel(db) {
  db.define('vcs_type', {
    vcs_type_id: {
      type: 'serial',
      key: true,
      required: false
    },
    vcs_type: {
      type: 'text',
      required: true
    },
    vcs_type_label: {
      type: 'text',
      required: true
    },
    description: {
      type: 'text',
      required: false
    },
    icon_url: {
      type: 'text',
      required: false
    }
  });
};
