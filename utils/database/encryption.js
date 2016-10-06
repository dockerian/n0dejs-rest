var crypto = require('crypto');

function FieldCrypt(password) {
  this.password = password;
  this.algorithm = 'aes-256-ctr';
  this.cleartext_encoding = "utf8";
  this.encrypted_encoding = "hex";
};

FieldCrypt.prototype.encrypt = function encrypt(cleartext) {
  if (!cleartext || cleartext.length === 0) {
    return "";
  }

  // TODO: generate IV for every encryption, and move to createCipheriv
  // https://nodejs.org/api/crypto.html#crypto_crypto_createcipheriv_algorithm_key_iv
  var cipher = crypto.createCipher(this.algorithm, this.password),
    encrypted = cipher.update(cleartext, this.cleartext_encoding, this.encrypted_encoding);
  encrypted += cipher.final(this.encrypted_encoding);
  return encrypted;
};

FieldCrypt.prototype.decrypt = function decrypt(encrypted) {
  if (!encrypted || encrypted.length === 0) {
    return "";
  }
  var decipher = crypto.createDecipher(this.algorithm, this.password),
    cleartext = decipher.update(encrypted, this.encrypted_encoding, this.cleartext_encoding);
  cleartext += decipher.final(this.cleartext_encoding);
  return cleartext;
};

module.exports = function (password) {
  return new FieldCrypt(password);
};
