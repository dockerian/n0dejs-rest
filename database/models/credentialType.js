var orm = require('orm');

module.exports = function CredentialTypeModel(db) {
  db.define('credential_type', {
    credential_type_id: {
      type: 'serial',
      key: true,
      required: false
    },
    credential_type: {
      type: 'text',
      required: true
    },
    credential_type_label: {
      type: 'text',
      required: true
    }
  });
};
