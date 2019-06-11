var axios = require("axios");
var tools = require('./tools');

module.exports = {
    getTokenSR: function(configuration, privKey, jwkID, issuer, audience, accessCode) {
        const clientID = configuration.client_id
        const signToken = tools.signToken(privKey, clientID, issuer, audience, 120, jwkID)
        const target = configuration.token_endpoint
        const requestBody = {
          grant_type: 'authorization_code',
          client_id: clientID,
          code: accessCode,
          client_assertion_type: 'urn%3Aietf%3Aparams%3Aoauth%3Aclient-assertion-type%3Ajwt-bearer',
          client_assertion: signToken
        }

        const config = {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }

        return axios.post(target, urlencoded(requestBody), config)
    }
}

function urlencoded(requestBody) {
    let bodyParams = []
    Object.entries(requestBody).forEach(function (param) {
        if (param[1] !== '') bodyParams.push(param.join('='))
    })
    return bodyParams.join('&')
}
