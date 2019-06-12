module.exports = {
    JSON_wellknown: function(scheme, host, port = '80') {
      var port = port === '80' || port === '443' ? '' : ':' + port
      var respJSON = JSON.stringify({
        'report-configuration': `${scheme}://${host}${port}/.well-known/kheops-report-configuration`,
        'jwks_uri': `${scheme}://${host}${port}/certs`
      });
      return respJSON
    },
    JSON_kheopsConfiguration: function(scheme, host, port = '80') {
      var port = port === '80' || port === '443' ? '' : ':' + port
      var respJSON = JSON.stringify({
        'jwks_uri': `${scheme}://${host}${port}/certs`,
        'token_endpoint_auth_method': 'kheops_private_key_jwt',
        'token_endpoint_auth_signing_alg': 'RS256',
        'redirect_uri': `${scheme}://${host}${port}/report.html`
      });
      return respJSON
    },
    JSON_cert: function(jwk) {
      var respJSON = JSON.stringify({
        keys:[{
            'n': jwk['n'],
            'e': jwk['e'],
            'kid': '0',
            'kty': jwk['kty'],
            'alg': 'RS256',
            'use': 'sig'
        }]
      });
      return respJSON
    }
}