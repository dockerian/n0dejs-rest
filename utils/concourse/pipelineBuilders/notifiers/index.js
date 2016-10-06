var HipChatNotifier = require('./hipchat');

module.exports = function factory(type) {
  try {
    return require('./' + type + '.js');
  } catch (exception) {
    console.error("Unable to find notification type", type);
  }
};
