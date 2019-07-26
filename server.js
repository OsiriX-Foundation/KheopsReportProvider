/*
Usefull link :
OpenID Connect Core - https://openid.net/specs/openid-connect-core-1_0-15.html
  See: 9.0 Client Authentication

JSON web keys - https://tools.ietf.org/html/rfc7638
*/
var tools = require('./js/tools');
var configuration = require('./js/configuration')
var tokens = require('./js/tokens');
var customrequests = require('./js/customrequests');
var generatepdf = require('./js/generatepdf');
var session = require('./js/session')

var http = require("http"),
    fs = require("fs"),
    pem2jwk = require('pem-jwk').pem2jwk,
    url = require("url"),
    path = require("path"),
    axios = require("axios");

var scheme
if (process.env.SCHEME !== undefined) {
  scheme = process.env.SCHEME;
} else {
  scheme = 'http'
}
var host
if (process.env.HOST !== undefined) {
  host = process.env.HOST;
} else {
  host = '10.195.108.50'
}
var port
if (process.env.PORT !== undefined) {
  port = process.env.PORT;
} else {
  port = '80'
}

const myaddr = `${scheme}://${host}${port === '80' || port === '443' ? '' : ':' + port}`

var privKey = fs.readFileSync('keys/privkey.pem', 'ascii');
var jwk = pem2jwk(privKey);
var jwkID = 0;
main ()

function main () {
  let cookie
  http.createServer(function(request, response) {
    var uri = url.parse(request.url).pathname
      , query =  `?${url.parse(request.url).query}`
      , filename = path.join(process.cwd(), '/html'+uri);

    switch (uri) {
      case '/.well-known':
        new Promise(function (resolve, reject) {
          resolve(configuration.JSON_wellknown(scheme, host, port))
        }).then(res => {
          tools.responseJSON(response, 200, res)
        })
        break;
      case '/.well-known/kheops-report-configuration':
        new Promise(function (resolve, reject) {
          resolve(configuration.JSON_kheopsConfiguration(scheme, host, port))
        }).then(res => {
          tools.responseJSON(response, 200, res)
        })
        break;
      case '/.well-known/kheops-wsi-viewer-configuration':
          new Promise(function (resolve, reject) {
            resolve(configuration.JSON_kheopsWSIViewerConfiguration(scheme, host, port))
          }).then(res => {
            tools.responseJSON(response, 200, res)
          })
          break;
      case '/certs':
        new Promise(function (resolve, reject) {
          resolve(configuration.JSON_cert(jwk))
        }).then(res => {
          tools.responseJSON(response, 200, res)
        })
        break;
      case '/report.html':
        new Promise(function (resolve, reject) {
          let result = setReport(response, filename, query);
          if (result === -1) {
            reject('error')
          } else {
            resolve('Set report done')
          }
        }).catch(err => {
          console.log(err)
        })
        break;
      case '/wsi-viewer':
        let wsiViewerFile = path.join(process.cwd(), '/viewer/viewer.html')
        tools.readFileWeb(wsiViewerFile, response)
        break;
      case (uri.match('^/viewer') || {}).input:
        let wsiViewerScriptFile = path.join(process.cwd(), `/viewer${uri}`)
        tools.readFileWeb(wsiViewerScriptFile, response)
        break
      case '/reportprovider':
        let reportFile = path.join(process.cwd(), '/html/reportprovider.html')
        tools.readFileWeb(reportFile, response)
        break;
      case '/series':
        new Promise(function (resolve, reject) {
          let cookie = session.readCookie(request.headers.cookie, request.headers['x-xsrf-token'])
          if (cookie === -1) {
            reject("Not authorized")
          }
          getConfFromCookie(cookie).then(res => {
            let studyUID = tools.getParameterByName('studyUID', query)
            let urlSeries = `${res.data.dicomweb_endpoint}/studies/${studyUID}/series`
            customrequests.getBearer(urlSeries, cookie.decryptAccessToken).then(res => {
              resolve(res)
            }).catch(err => {
              reject(err)
            })
          }).catch(err => {
            reject(err)
          })
        }).then(res => {
          tools.responseJSON(response, 200, JSON.stringify(res.data))
        }).catch(err => {
          console.log(err)
          tools.responseTextPlain(response, 500, "An error")
        })
        break;
      case '/studies':
        new Promise(function (resolve, reject) {
          let cookie = session.readCookie(request.headers.cookie, request.headers['x-xsrf-token'])
          if (cookie === -1) {
            reject("Not authorized")
          }
          getConfFromCookie(cookie).then(res => {
            let urlStudies = `${res.data.dicomweb_endpoint}/studies`
            customrequests.getBearer(urlStudies, cookie.decryptAccessToken).then(res => {
              resolve(res)
            }).catch(err => {
              reject(err)
            })
          }).catch(err => {
            reject(err)
          })
        }).then(res => {
          tools.responseJSON(response, 200, JSON.stringify(res.data))
        }).catch(err => {
          tools.responseTextPlain(response, 500, err)
        })
        break;
      case '/configuration_kheops':
        new Promise(function (resolve, reject) {
          let cookie = session.readCookie(request.headers.cookie, request.headers['x-xsrf-token'])
          if (cookie === -1) {
            reject("Not authorized")
          }
          axios.get(cookie.confuri).then(res => {
            resolve(res)
          }).catch(err => {
            reject(err)
          })
        }).then(res => {
          tools.responseJSON(response, 200, JSON.stringify(res.data))
        }).catch(err => {
          tools.responseTextPlain(response, 500, err)
          console.log(err)
        })
        break;
      case '/user_info':
        new Promise(function (resolve, reject) {
          let cookie = session.readCookie(request.headers.cookie, request.headers['x-xsrf-token'])
          if (cookie === -1) {
            reject("Not authorized")
          }
          getConfFromCookie(cookie).then(res => {
            customrequests.getBearer(res.data.userinfo_endpoint, cookie.decryptAccessToken).then(res => {
              resolve(res)
            }).catch(err => {
              reject(err)
            })
          }).catch(err => {
            reject(err)
          })

        }).then(res => {
          tools.responseJSON(response, 200, JSON.stringify(res.data))
        }).catch(err => {
          tools.responseTextPlain(response, 500, err)
          console.log(err)
        })
        break;
      case '/redirect':
        let cookie = session.readCookie(request.headers.cookie, request.headers['x-xsrf-token'])
        if (cookie === -1) {
          reject("Not authorized")
        }
        tools.responseJSON(response, 200, JSON.stringify({ 'redirect_uri': cookie.returnuri }))

        break;
      case '/post_pdf':
        new Promise(function (resolve, reject) {
          let studyUID_postPDF = tools.getParameterByName('studyUID', query)
          let cookie = session.readCookie(request.headers.cookie, request.headers['x-xsrf-token'])
          if (cookie === -1) {
            reject("Not authorized")
          }
          getConfFromCookie(cookie).then(res => {
            let currentConfiguration = res.data
            generatepdf.createPDF(
              response,
              studyUID_postPDF,
              cookie.decryptAccessToken,
              currentConfiguration
            )
          }).catch(err => {
            reject(err)
          })

        }).catch(err => {
          if (err === 'Not authorized') {
            tools.responseTextPlain(response, 401, err)
          } else {
            tools.responseTextPlain(response, 500, err)
          }
        })
        break;
      default:
        tools.readFileWeb(filename, response);
    }
  }).listen(parseInt(80, 10));

  console.log(myaddr + "/\nCTRL + C to shutdown");
}

function getConfFromCookie(cookie) {
  return axios.get(cookie.confuri)
}

function setReport(response, filename, query) {
  if (checkQueryParameters(response, query) === -1) {
    return -1
  }
  var urlConfig = tools.getParameterByName('conf_uri', query)
  var urlReturn = tools.getParameterByName('return_uri', query)
  var accessCode = tools.getParameterByName('code', query)
  var clientID = tools.getParameterByName('client_id', query)
  var studyUID = tools.getParameterByName('studyUID', query)
  let urlInformations = parseUrlConfig(response, urlConfig)
  if (urlInformations === -1) {
    return -1
  }

  if (urlInformations.hostname && urlInformations.protocol && urlInformations.path) {
    axios.get(urlInformations.href).then(res => {
      let currentConfiguration = res.data
      var urlPort = port === '80' || port === '443' ? '' : ':' + port
      tokens.getTokenSR(currentConfiguration, privKey, clientID, jwkID, accessCode, `${scheme}://${host}${urlPort}/report.html`).then(res => {

        let dataAccessToken = res.data
        let setCookie = session.generateCookie(urlInformations.href, urlReturn, studyUID, clientID, dataAccessToken)
        let headers = {}

        if (setCookie !== '') {
          headers['Set-Cookie'] = setCookie['cookie']
          headers['Location'] = `${myaddr}/reportprovider?state=${setCookie.state}`
          response.writeHead(302, headers);
          response.end();
        } else {
          tools.responseTextPlain(response, 500, 'Cant create an access')
        }

      }).catch(err => {
        if (err.response !== undefined) {
          console.log(err.response.data)
          var responseJSON = JSON.stringify(err.response.data);
          tools.responseJSON(response, err.response.status, responseJSON)
        } else {
          console.log(err)
        }
        return -1
      })

    })
  } else {
    const error = {}
    error['error'] = 'url config not valid'
    var responseJSON = JSON.stringify({error});
    tools.responseJSON(response, 500, responseJSON)
    return -1
  }
}

function checkQueryParameters(response, query) {
  if (!query.includes('conf_uri') || !query.includes('code') ||
    !query.includes('studyUID') || !query.includes('client_id')) {
    const error = {}
    error['description'] = 'Miss query parameters'
    error['queries'] = [
      !query.includes('conf_uri') ? 'conf_uri' : '',
      !query.includes('code') ? 'code' : '',
      !query.includes('studyUID') ? 'studyUID' : '',
      !query.includes('client_id') ? 'client_id' : ''
    ]
    var responseJSON = JSON.stringify({error});
    tools.responseJSON(response, 500, responseJSON)
    return -1
  }
}

function parseUrlConfig(response, urlConfig) {
  try {
    var urlInformations = url.parse(urlConfig)
    return urlInformations
  } catch (err) {
    const error = {}
    error['error'] = 'Impossible to parse the url config'
    var responseJSON = JSON.stringify({error});
    tools.responseJSON(response, 500, responseJSON)
    return -1
  }
}
