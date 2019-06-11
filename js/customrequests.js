var axios = require("axios");

module.exports = {
  getBearer: function(url, TokenSR) {
    const config = generateHeaders(TokenSR)

    return axios.get(url, config)
  }
}

function generateHeaders(TokenSR) {
  return {
      headers: {
        'Authorization': `Bearer ${TokenSR}`
      }
  }
}