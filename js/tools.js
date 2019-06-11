var fs = require("fs"),
    jwt = require('jsonwebtoken'),
    path = require("path");

module.exports = {
    signToken: function (privKey, clientID, issuer, audience, exp, jwkID) {
        var optionsJWT = {
          algorithm: 'RS256',
          issuer: issuer,
          subject: clientID,
          audience: audience,
          jwtid: jwkID.toString(),
          keyid: '0',
          expiresIn: 120
        }
    
        return jwt.sign({}, privKey, optionsJWT)
    },
    getParameterByName: function (name, query) {
        name = name.replace(/[\[\]]/g, '\\$&');
        var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
            results = regex.exec(query);
        if (!results) return null;
        if (!results[2]) return '';
        return decodeURIComponent(results[2].replace(/\+/g, ' '));
    },
    parseToJSON: function(value) {
        if (value) {
            try {
              return JSON.parse(value)
            } catch (e) {
              console.log(`JSONParse value :`)
              console.log(value)
              console.log(`JSONParse error :`)
              console.log(e)
              return -1
            }
        }
    },
    responseJSON: function (response, code, responseJSON) {
        response.writeHead(code, {"Content-Type": "application/json"});
        response.write(responseJSON);
        response.end();
        return;
    },
    responseTextPlain: function (response, code, value) {
        response.writeHead(code, {"Content-Type": "text/plain"});
        response.write(value);
        response.end();
        return;
    },
    responseTextXML: function (response, code, value) {
      response.writeHead(code, {"Content-Type": "text/xml"});
      response.write(value);
      response.end();
      return;
    },
    readFileWeb: function (filename, response, setCookie='') {
      var contentTypesByExtension = {
        '.html': "text/html",
        '.css':  "text/css",
        '.js':   "text/javascript"
      };
  
      fs.exists(filename, function(exists) {
  
        if(!exists) {
          response.writeHead(404, {"Content-Type": "text/plain"});
          response.write("404 Not Found\n");
          response.end();
          return;
        }
  
        if (fs.statSync(filename).isDirectory()) filename += 'index.html';
  
        fs.readFile(filename, "binary", function(err, file) {
          if(err) {
            response.writeHead(500, {"Content-Type": "text/plain"});
            response.write(err + "\n");
            response.end();
            return;
          }
  
          var headers = {};
          var contentType = contentTypesByExtension[path.extname(filename)];
          if (contentType) {
            headers["Content-Type"] = contentType;
          }
          if (setCookie !== '') {
            headers['Set-Cookie'] = setCookie['cookie']
          }
          response.writeHead(200, headers);
          response.write(file, "binary");
          response.end();
        });
      });
    }
}