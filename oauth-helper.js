const ClientOAuth2 = require('client-oauth2');
const request = require('request');

module.exports = function (RED) {
    function saveNewToken(credentialsID, credentials, tokenData) {
        console.log("saving token:", credentials, tokenData);
        credentials.access_token = tokenData.data.access_token;
        credentials.expires = tokenData.expires;
        credentials.refresh_token = tokenData.data.refresh_token;
        credentials.user_id = tokenData.data.user_id;
        RED.nodes.addCredentials(credentialsID, credentials);
        console.log("creds:", credentials);
    }

    function getFitbitOauth(credentials) {
        return new ClientOAuth2({
            clientId: credentials.clientID,
            clientSecret: credentials.clientSecret,
            accessTokenUri: 'https://api.fitbit.com/oauth2/token',
            authorizationUri: 'https://www.fitbit.com/oauth2/authorize',
            scopes: ['activity', 'heartrate', 'location', 'nutrition', 'profile', 'settings', 'sleep', 'social', 'weight']
        });
    }

    function _makeRequest(method, url, token) {
        console.log("Making request", method, url, token);
        return new Promise((resolve, reject) => {
            request(token.sign({
                method: method,
                url: url
            }), (err, _response, body) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(body);
                }
            });
        });
    }

    function makeRequest(method, url, credentials, credentialsID) {
        const oauth = getFitbitOauth(credentials);
        const token = oauth.createToken({
            access_token: credentials.access_token,
            expires_in: (new Date(credentials.expires).getTime() - new Date().getTime()) / 1000,
            token_type: 'Bearer',
            refresh_token: credentials.refresh_token,
            user_id: credentials.user_id,
            clientID: credentials.clientID,
            clientSecret: credentials.clientSecret
        });

        let requestPromise;
        if (token.expired()) {
            requestPromise = token.refresh().then(newToken => {
                saveNewToken(credentialsID, credentials, newToken);
                return newToken;
            }).then(newToken => {
                return _makeRequest(method, url, newToken);
            })
        } else {
            requestPromise = _makeRequest(method, url, token);
        }

        return requestPromise.catch(err => {
            console.error("Error requesting from fitbit", err);
        });
    }

    return {
        saveNewToken,
        makeRequest,
        getFitbitOauth
    }
}