var orm = require('orm');

module.exports = function CredentialModel(db) {
  db.define('credential', {
    credential_id: {
      type: 'serial',
      key: true,
      required: false
    },
    credential_type_id: {
      type: 'integer',
      required: true
    },
    credential_key: {
      type: 'text',
      encrypted: true
    },
    credential_value: {
      type: 'text',
      encrypted: true
    },
    credential_extra: {
      type: 'text',
      encrypted: true
    },
    created: {
      type: 'text'
    },
    modified: {
      type: 'text'
    },
    label: {
      type: 'text'
    },
    owner_id: {
      type: 'text'
    }
  }, {
    methods: {
      serialize: function () {
        var credentialType = '';
        if (this.credential_type) {
          if (this.credential_type.credential_type) {
            credentialType = this.credential_type.credential_type;
          } else {
            credentialType = this.credential_type;
          }
        }

        return {
          credential_id: this.credential_id,
          credential_type: credentialType,
          created: this.created,
          modified: this.modified,
          owner_id: this.owner_id,
          label: this.label
        };
      }
    }
  });
};
