var http = require('http'),
  should = require('should'),
  path = require('path'),
  crypt = require('../utils/database/encryption');

describe('utils/database/encryption', function (done) {
  var context = {},
    test_message = "I sought to group the letters so as to form words. Quite impossible! When I put them together by twos, threes, fives or sixes, nothing came of it but nonsense. To be sure the fourteenth, fifteenth and sixteenth letters made the English word \"ice\"; the eighty-third and two following made \"sir\"; and in the midst of the document, in the second and third lines, I observed the words, \"rots,\" \"mutabile,\" \"ira,\" \"net,\" \"atra.\"";

  before(function (done) {
      done();
    }),

    it("Encrypt/decrypt test, good passwords", function (done) {
      var bad_decrypted,
        encrypted1,
        encrypted2,
        decrypted1,
        decrypted2,
        password1 = "password1",
        password2 = "password2";

      // Encrypt/decrypt with password 1.
      encrypted1 = crypt(password1).encrypt(test_message);
      decrypted1 = crypt(password1).decrypt(encrypted1);

      decrypted1.should.be.equal(test_message);
      encrypted1.should.not.be.equal(test_message);

      // Encrypt/decrypt with password 2.
      encrypted2 = crypt(password2).encrypt(test_message);
      decrypted2 = crypt(password2).decrypt(encrypted2);

      decrypted2.should.be.equal(test_message);
      encrypted2.should.not.be.equal(test_message);
      encrypted2.should.not.be.equal(encrypted1);

      done();
    });

  it("encrypt doesn't throw on undefined text", function () {
    var password1 = "password1",
      text;
    var encrypted = crypt(password1).encrypt(text);
    encrypted.length.should.be.equal(0);
  });

  it("encrypt doesn't throw on empty text", function () {
    var password1 = "password1";
    var encrypted = crypt(password1).encrypt("");
    encrypted.length.should.be.equal(0);
  });

  it("decrypt doesn't throw on undefined text", function () {
    var password1 = "password1",
      text;
    var encrypted = crypt(password1).decrypt(text);
    encrypted.length.should.be.equal(0);
  });

  it("decrypt doesn't throw on empty text", function () {
    var password1 = "password1";
    var encrypted = crypt(password1).decrypt("");
    encrypted.length.should.be.equal(0);
  });


  it("Encrypt/decrypt test, bad password", function (done) {
    var bad_decrypted,
      bad_password = "bad_password",
      password1 = "password1",
      encrypted,
      decrypted;

    // Encrypt/decrypt.
    encrypted = crypt(password1).encrypt(test_message);
    decrypted = crypt(password1).decrypt(encrypted);

    decrypted.should.be.equal(test_message);
    encrypted.should.not.be.equal(test_message);

    // Attempt to decrypt with a bad password.
    bad_decrypted = crypt(bad_password).decrypt(encrypted);
    bad_decrypted.should.not.be.equal(test_message);

    done();
  });
});
