/* jshint esversion: 6 */
/* jshint node: true */

'use strict';
var request = require('request-promise');
var authToken = require('./common').authToken;

class Onboarding {

    onboard(authInfo) {
        console.log("Onboarding SmartThings Hub");

        // this comes from the onboardFlow property 
        // as part of the schema and manifest.xml
        var params = 'grant_type=authorization_code&client_id=' + authInfo[0].client_id
                   + '&client_secret=' + authInfo[0].client_secret
                   + '&redirect_uri=' + authInfo[0].redirect_url
                   + '&code=' + authInfo[1]
                   + '&scope=app';

        // build request URI
        var requestUri = 'https://graph.api.smartthings.com/oauth/token?' + params;
        var method = "POST";

        // Set the headers
        var headers = {
            'Accept': 'application/json',
            'cache-control': 'no-cache'
        }

        var options = {
            url: requestUri,
            method: method,
            headers: headers,
            followAllRedirects: true
        };

        return request(options)
            .then(function (body) {
                var tokenInfo = JSON.parse(body); // This includes refresh token, scope etc..

                var authTokens = {};
                authTokens['access'] = new authToken(
                    tokenInfo.access_token,
                    authToken.convertTtlToExpiration(tokenInfo.expires_in),
                    tokenInfo.token_type,
                    tokenInfo.scope
                );

                // SmartThings requires the client_id for the endpoint URL
                authTokens['access'].client_id = authInfo[0].client_id;
                
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