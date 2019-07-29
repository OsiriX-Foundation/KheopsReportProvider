module.exports = {
    JSON_wellknown: function(scheme, host, port = '80') {
      var port = port === '80' || port === '443' ? '' : ':' + port
      var respJSON = JSON.stringify({
        'report-configuration': `${scheme}://${host}${port}/.well-known/kheops-report-configuration`,
        'jwks_uri': `${scheme}://${host}${port}/certs`
      });
      return respJSON
    },
    // https://tools.ietf.org/html/rfc7591
    JSON_kheopsConfiguration: function(scheme, host, port = '80') {
      var port = port === '80' || port === '443' ? '' : ':' + port
      var respJSON = JSON.stringify({
        'jwks_uri': `${scheme}://${host}${port}/certs`,
        'response_type': 'code',
        'token_endpoint_auth_method': 'private_key_jwt',
        'token_endpoint_auth_signing_alg': 'RS256',
        'redirect_uri': `${scheme}://${host}${port}/report.html`,
        'client_name': 'Kheops Report Provider',
        'client_uri': 'https://kheops.online',
        'contacts': [
          'contact@kheops.online'
        ]
      });
      return respJSON
    },
    JSON_kheopsWSIViewerConfiguration: function(scheme, host, port = '80') {
      var port = port === '80' || port === '443' ? '' : ':' + port
      var respJSON = JSON.stringify({
        'jwks_uri': `${scheme}://${host}${port}/certs`,
        'response_type': 'token',
        'redirect_uri': `${scheme}://${host}${port}/wsi-viewer`,
        'client_name': 'Kheops Report Provider',
        'client_uri': 'https://kheops.online',
        'contacts': [
          'contact@kheops.online'
        ],
        'supported_modalities': [
          'SM'
        ]
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
