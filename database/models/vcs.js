var orm = require('orm');

module.exports = function VcsModel(db) {
  db.define('vcs', {
    vcs_id: {
      type: 'serial',
      key: true,
      required: false
    },
    vcs_type_id: {
      type: 'integer',
      required: true
    },
    api_url: {
      type: 'text'
    },
    browse_url: {
      type: 'text'
    },
    credential_id: {
      type: 'integer'
    },
    skip_ssl_validation: {
      type: 'boolean'
    },
    label: {
      type: 'text'
    }
  }, {
    methods: {
      serialize: function () {
        return {
          vcs_id: this.vcs_id,
          vcs_type: this.vcs_type,
          api_url: this.api_url,
          browse_url: this.browse_url,
          credential_id: this.credential_id,
          skip_ssl_validation: this.skip_ssl_validation,
          label: this.label
        };
      }
    }
  });
};
