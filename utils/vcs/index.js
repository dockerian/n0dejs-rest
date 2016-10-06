module.exports = function factory(vcs) {
  var vcsType = vcs.vcs_type.vcs_type.toLowerCase();
  try {
    return require('./' + vcsType)(vcs);
  } catch (exception) {
    console.error("Unable to find VCS type", vcsType);
  }
};
