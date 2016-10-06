var orm = require('orm');

module.exports = function UserModel(db) {
  db.define('user', {
    user_id: {
      type: 'serial',
      key: true,
      required: false
    },
    uaa_id: {
      type: 'text',
      required: false
    },
    username: {
      type: 'text',
      required: false
    },
    created: {
      type: 'text',
      required: false
    }
  }, {
    methods: {
      serialize: function () {
        return {
          user_id: this.user_id,
          username: this.username,
          uaa_id: this.uaa_id,
          created: this.created
        };
      }
    }
  });
};
