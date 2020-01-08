const crypto = require('crypto');
const algorithm = 'aes-256-cbc'
const key = crypto.randomBytes(32);
const iv = crypto.randomBytes(16);
const secret = crypto.randomBytes(64);

module.exports = {
  generateCookie: function(conf_uri, return_uri, studyUID, clientID, tokenSR) {
    const encryptToken = encrypt(tokenSR.access_token)
    const hashToken = hash(tokenSR.access_token + conf_uri + clientID + return_uri)
    const sessionState = generateSessionState()
    return {
      'cookie': [`studyUID=${studyUID}; Secure`, `confuri=${conf_uri}; Secure`, `returnuri=${return_uri}; Secure`, `clientid=${clientID}; Secure`, `accesstoken=${encryptToken}; Expires=${new Date(Date.now() + 3600000).toUTCString()}; HttpOnly; Secure`],
      'sessionState': sessionState,
      'state': hashToken
    }
  },
  readCookie: function(cookieToParse, hashedToken) {
    let cookie = parseCookies(cookieToParse)
    if (cookie.accesstoken !== undefined && hashedToken !== undefined) {
      cookie.decryptAccessToken = decrypt(cookie.accesstoken)
      const hashToken = hash(cookie.decryptAccessToken + cookie.confuri + cookie.clientid + cookie.returnuri)
      if (hashToken === hashedToken) {
        return cookie
      } else {
        return -1
      }
    } else {
      return -1
    }
  }
}

function generateSessionState() {
  const validChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let stateValue = ''
  for (let i = 0; i < 40; i++)
    stateValue += validChar.charAt(Math.floor(Math.random() * validChar.length));
  return stateValue
}

function hash(value) {
  const hash = crypto.createHmac('sha256', secret)
    .update(value)
    .digest('hex');
  return hash
}

function parseCookies (rc) {
  var list = {}

  rc.split(';').forEach(function( cookie ) {
    var parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });

  return list;
}

function encrypt(value) {
  let cipher = crypto.createCipheriv(algorithm, Buffer.from(key), iv);
  let encrypted = cipher.update(value);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return encrypted.toString('hex');
}

function decrypt(value) {
  let encryptedText = Buffer.from(value, 'hex');
  let decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
