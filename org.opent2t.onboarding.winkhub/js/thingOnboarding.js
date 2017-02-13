/* jshint esversion: 6 */
/* jshint node: true */

'use strict';
var request = require('request-promise');
var authToken = require('./common').authToken;

class Onboarding {

    onboard(authInfo) {
        console.log("Onboarding Wink Hub");

        // this comes from the onboardFlow property 
        // as part of the schema and manifest.xml
        var postData = JSON.stringify({
            'client_id': authInfo[1].client_id,
            'client_secret': authInfo[1].client_secret,
            'username': authInfo[0].username,
            'password': authInfo[0].password,
            'grant_type': 'password'
        });

        // build request URI
        var requestUri = "https://api.wink.com/oauth2/token";
        var method = "POST";

        // Set the headers
        var headers = {
            'Content-Type': 'application/json',
            'Content-Length': postData.length
        }

        var options = {
            url: requestUri,
            method: method,
            headers: headers,
            body: postData,
            followAllRedirects: true
        };

        return request(options)
            .then(function (body) {
                var tokenInfo = JSON.parse(body); // This includes refresh token, scope etc..
                
                var authTokens = {};
                authTokens['access'] = new authToken(
                    tokenInfo.access_token,
                    0,
                    tokenInfo.token_type,
                    tokenInfo.scopes
                );

                authTokens['refresh'] = new authToken(
                    tokenInfo.access_token,
                    undefined,
                    tokenInfo.token_type,
                    tokenInfo.scopes
                );

                console.log(JSON.stringify(authTokens, null, 2));
                
                return authTokens;
            })
            .catch(function (err) {
                console.log("Request failed to: " + options.method + " - " + options.url);
                console.log("Error            : " + err.statusCode + " - " + err.response.statusMessage);
                // todo auto refresh in specific cases, issue 74
                throw err;
            });
    }
}

module.exports = Onboarding;