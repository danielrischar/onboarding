var q = require('q');
var dgram = require('dgram');

// Magic for discovering a Flux WiFi bulb, reverse engineered with WireShark.
const discoveryPort = 48899;
const discoveryMessage = 'HF-A11ASSISTHREAD';

/**
 * Discovers devices that correspond to known SSIDs
 */
function ssidDiscover(networks) {
    var devicesFound = [];
    
    networks.forEach( (network) => {
        // Check the network name against known good networks
        if (network.ssid.startsWith("Mordor")) {
            var device = {
                friendlyName: "Flux Bulb",
                controlId: network.ssid,
                deviceType: "Flux-Bulb",
                flow: "blah flow"
            };

            devicesFound.push(device);
        }
    });

    return devicesFound;
}

/**
 * Sends out a broadcast dgram that Flux wifi bulbs will respond to.
 */
function broadcastDiscover(timeout) {
    var deferred = q.defer();
    var devicesFound = [];

    var server = dgram.createSocket('udp4');
    var broadcastAddress =  '255.255.255.255';

    server.on('error', (err) => {
        throw new Error("Broadcast error: ", + err);
    });

    server.on('message', (msg, rinfo) => {
        var msgString = msg.toString();

        if (msgString.startsWith(rinfo.address)) {
            var parts = msg.toString().split(',');
            if (parts.length > 2) {
                var deviceInfo = {
                    raw: msg.toString(),
                    deviceType: "Flux WiFi Bulb",
                    controlId: parts[1],
                    address: parts[0],
                    friendlyName: "Flux WiFi Bulb"
                }

                devicesFound.push(deviceInfo);
            }
        }
    });

    server.on('listening', () => {
        server.setBroadcast(true);
        var messageBuffer = Buffer.from(discoveryMessage);
        server.send(messageBuffer, 0, messageBuffer.length, discoveryPort, broadcastAddress);
    });

    server.bind(discoveryPort);

    setTimeout(() => {
        server.close();
        deferred.resolve(devicesFound);
    }, timeout);

    return deferred.promise;
}

/**
 * Discovers and onboards Flux WiFi bulbs
 */
class Onboarding {

    onboard(onboardingInfo) {
        if (onboardingInfo.deviceType == "WiFi-AP") {
            //doOnboardFlow(onboardingInfo);
            throw new Error("Onboarding Flux APs is not implemented.");
        }

        return onboardingInfo;
    }

    /**
     * Discovers any devices on the current network using a number of different methods.  Each time a device is found
     * that is understood by opent2t, it will be onboarded and the discoveryCallback will be called with the device info
     * 
     */
    static discover(timeout, extraInfo) {
        var foundDevices = [];

        // Find them by SSID
        foundDevices = ssidDiscover(extraInfo.networks);
        console.log("Flux Bulb APs found: " + foundDevices.length);

        // Find them via broadcast
        return broadcastDiscover(timeout).then( (devices) => {
            console.log("Flux devices on network: " + devices.length);
            foundDevices = foundDevices.concat(devices);
            foundDevices.forEach( (device) => {
                device.onboardingModule = "opent2t-onboarding-org-opent2t-onboarding-wifi-wemo";
            });
            return foundDevices;
        });
    }

    
}

module.exports = Onboarding;
