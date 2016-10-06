function GetResource(resourceName, passed, versionRef) {
  this.get = resourceName;
  if (passed && passed.length > 0) {
    this.passed = passed;
  }

  if (versionRef) {
    this.version = {
      ref: versionRef
    }
  }
}

module.exports = GetResource;
