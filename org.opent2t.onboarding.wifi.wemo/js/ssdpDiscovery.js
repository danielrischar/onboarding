var SSDPClient = require('node-ssdp').Client;
var q = require('q');
var http = require('http');
var Url = require('url');
var xml2js = require('xml2js');
var xmlbuilder = require('xmlbuilder');

class Discovery {
    constructor(urn) {
        this._discoveryTimeout = 10000;
        
        // If not provided, search for all ssdp devices
        if (!urn) {
            urn = "ssdp:all";
        }

        this._urn = urn;
    }

    /**
     * Uses SSDP to discover uPnP devices on the current network that response to a specific urn (or all)
     */
    discover(timeout) {
        var devices = [];

        if (timeout) {
            this._discoveryTimeout = timeout;
        }

        var deferred = q.defer();
        
        var handleSsdpResponse = function(msg) {
            // Get and parse the device details, and send it to the callback function
            this._getDeviceDetails(msg.LOCATION).then((deviceInfo) => {
                devices.push(deviceInfo);
            });
        }.bind(this);

        // Start a search for each provider URN that is supported
        // A device may respond to more than one URN, so the caller needs to handle possible duplicate devices.
        var ssdpClient = new SSDPClient({});
        ssdpClient.removeAllListeners('response');
        ssdpClient.on('response', handleSsdpResponse);
        ssdpClient.search(this._urn);
        
        // End the search after the timeout
        setTimeout(() => {
            ssdpClient.stop();
            deferred.resolve(devices);
        }, this._discoveryTimeout);
        
        return deferred.promise;
    }

    /**
     * Gets details from an SSDP device by performing a simple GET to the XML path provided in the
     * initial discovery.
     */
    _getDeviceDetails(fullDeviceUrl) {
        var deferred = q.defer();
        var devicePath = Url.parse(fullDeviceUrl);

        // Do a get to the device
        var options = {
            host: devicePath.hostname,
            port: devicePath.port,
            path: devicePath.path,
            method: 'GET'
        }

        // Small helper for throwing request errors that are actionable.
        // This should be replaced with common erro handling in the future.
        var handleRequestError = function(errorDetail) {
            throw new Error("Unable to get device information from " + fullDeviceUrl + " error: " + errorDetail);
        }
        
        var req = http.request(options, function(res) {
            var body = "";
            res.setEncoding('utf8');

            res.on('data', function(chunk) {
                body += chunk;
            });

            res.on('end', function() {
                if (res.statusCode === 200) {
                    // The upnp device info is XML, and needs to be converted into a JSON object for
                    // portability from here on out.
                    return xml2js.parseString(body, {explicitArray: false }, function(err, result) {
                        var deviceInfo = {
                            raw: result,
                            deviceType: result.root.device.deviceType,
                            friendlyName: result.root.device.friendlyName,
                            controlId: result.root.device.UDN
                        }
                        
                        // Notify caller that a device was found.
                        deferred.resolve(deviceInfo);
                    }.bind(this));
                } else {
                    handleRequestError(res.statusCode);
                }
            }.bind(this));

            res.on('error', function(err) {
                handleRequestError(err);
            });

        }.bind(this));

        req.on('error', function(err) {
            handleRequestError(err);
        });

        req.end();

        return deferred.promise;
    }

    /**
     * Makes a SOAP formated reqeust to the host.
     */
    static soapRequestOld(hostInfo, serviceType, action, args) {
        var deferred = q.defer();

        var options = hostInfo;
        options.method = 'POST';
        options.headers = {
            'SOAPACTION':  serviceType + '#' + action,
            'Content-Type': 'text/xml; charset="utf-8"'
        };
        
        var builder = new xml2js.Builder();
        var soapXml = '<?xml version="1.0" encoding="utf-8"?>'
                      +       '<s:Envelope'
                      +          's:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/'
                      +          'xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"'
                      +          '<s:Body>'
                      +              '<u:' + action + ' xmlns:u=' + serviceType + '>'
                      +                  builder.buildObject(args)
                      +              '</u:' + action + '>'
                      +          '</s:Body>'
                      +      '</s:Envelope>';

        // console.log("Request to:");
        // console.log(JSON.stringify(options, null, 2));
        // console.log("Contents:");
        // console.log(soapXml);
        
        var request = http.request(options, function(response) {
            var body = "";
            response.setEncoding('utf8');
            
            // Get the full response
            response.on('data', (chunk) => {
                body += chunk;
            });

            response.on('end', () => {
                if (response.statusCode == 200) {
                    xml2js.parseString(body, { explicitArray: false}, (result) => {
                        deferred.resolve(result);
                    });
                } else {
                    deferred.reject("Failed to make SOAP request");
                }
            });

            response.on('error', (error) => {
                deferred.reject("Could not make SOAP request");
            })

            req.write(data);
            req.end();
        }).catch((error) => {
            deferred.reject(error);
        });

        return deferred.promise();
    }


    static request(options, data) {
        var deferred = q.defer();
        var req = http.request(options, (res) => {
            var body = "";
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    xml2js.parseString(body, { explicitArray: false }, (err, result) => {
                        if (err) {
                            defered.reject(err);
                        } else {
                            deferred.resolve(result);
                        }
                    });
                } else {
                    deferred.reject('HTTP ' + res.statusCode + ': ' + body);
                }
            });

            res.on('error', (err) => {
               deferred.reject("Error with response: " + err);
            });
        });

        req.on('error', (err) => {
            deferred.reject("Error with request: " + err);
        });

        if (data) {
            req.write(data);
        }

        req.end();

        return deferred.promise;
    };

    static soapRequest(hostInfo, serviceType, action, body) {
        var cb = function(value) {
            deferred.reject(value);
        }

        var xml = xmlbuilder.create('s:Envelope', {
            version: '1.0',
            encoding: 'utf-8',
            allowEmpty: true
        })
        .att('xmlns:s', 'http://schemas.xmlsoap.org/soap/envelope/')
        .att('s:encodingStyle', 'http://schemas.xmlsoap.org/soap/encoding/')
        .ele('s:Body')
        .ele('u:' + action)
        .att('xmlns:u', serviceType);

        var payload = (body ? xml.ele(body) : xml).end();

        var options = {
            host: hostInfo.host,
            port: hostInfo.port,
            path: hostInfo.path,
            method: 'POST',
            headers: {
                'SOAPACTION': '"' + serviceType + '#' + action + '"',
                'Content-Type': 'text/xml; charset="utf-8"'
            }
        };

        return Discovery.request(options, payload).then( (response) => {
            return response['s:Envelope']['s:Body']['u:' + action + 'Response'];
        });
    };
}

module.exports = Discovery;