var ssdp = require('./ssdpDiscovery');
var q = require('q');
var Url = require('url');
var wificontrol = require('wifi-control');

wificontrol.init({
    debug: false
});

//var Regex = require('regex');

/**
 * Discovers devices that correspond to known SSIDs
 */
function ssidDiscover(networks) {
    var devicesFound = [];
    
    networks.forEach( (network) => {
        // Check the network name against known good networks
        if (network.ssid.startsWith("WeMo.")) {
            var device = {
                friendlyName: network.ssid,
                controlId: network.ssid,
                deviceType: "Unpaired",
                flow: {} // TODO: This flow should come from the manifest.
            };

            devicesFound.push(device);
        }
    });

    return devicesFound;
}

/**
 * Connects the current machine to the specified WiFi access point
 * 
 * @param {Object} ap
 * @param {string} ap.ssid - SSID of the network
 * @param {string} ap.password - Password for the network, if required
 */
function connectToAp(ssid, password) { 
    var deferred = q.defer();
    
    var ifaceState = wificontrol.getIfaceState();

    var ap = {
        ssid: ssid,
        password: password
    };

    wificontrol.connectToAP(ap, (err, response) => {
        if (err) {
            deferred.reject(err);
        } else {
            deferred.resolve(response);
        }
    });

    return deferred.promise;
}

/** 
 * Connects to a Wemo device hotspot AP and requests a list of access points that it can connect to itself.
 */
function getDeviceAps(deviceInfo) {
    var device = Url.parse(deviceInfo.address);

    var options = {
        host: device.hostname,
        port: device.port,
        path: "/upnp/control/WiFiSetup1"
    };

    return ssdp.soapRequest(options, "urn:Belkin:service:WiFiSetup:1", "GetApList", null).then( (response) => {
        console.log(response);
        // The WeMo response looks like the following
        // Page:1/1/6$\n
        // and then repeats <WIFINAME>|<channel>|<auth>|<encryption>,\n
        var apSsids = [];
        var apsToParse = response.ApList.split('\n');
        for(var i = 1; i < apsToParse.length; ++i) {
            if (apsToParse[i] != '') {
                var parts = apsToParse[i].split('|');
                apSsids.push({
                    ssid: parts[0],
                    channel: parts[1],
                    auth: parts[2],
                    encrypt: parts[3].replace(',', '')
                });;
            }
        }

        return apSsids;
    });
}

/**
 * Moves a device to use a new access point (ssid, password)
 */
function moveDeviceToAp(deviceInfo, ap) {
    var device = Url.parse(deviceInfo.address);

    console.log("Moving device " + deviceInfo.friendlyName + " to " + ap.ssid + " with password " + ap.password);

    var options = {
        host: device.hostname,
        port: device.port,
        path: "/upnp/control/WiFiSetup1"
    };

    

    // WeMo requires that the password be pre-encrypted
    return getMetaInfo(deviceInfo).then( (metaInfo) => {
        // Get the salt and the iv off of the metadata
        console.log(metaInfo);
        //ap.password = encryptPassword(ap.password, metaInfo.salt, metaInfo.iv);
        console.log(JSON.stringify(ap, null, 2));
        return ssdp.soapRequest(options, "urn:Belkin:service:WiFiSetup:1", "ConnectHomeNetwork", ap).then( (response) => {
            console.log(response);
            if (response.PairingStatus == "Connecting") {
                // It's connecting.

                // TODO: Though the status from ConnectHomeNetwork was connecting, I haven't gotten this to work yet.
                // Even on an Open Wifi network, the device doesn't seem to complete the ConnectHomeNetwork process.

                return ssdp.soapRequest(options, "urn:Belkin:service:WiFiSetup:1", "CloseSetup", null).then( (response) => {
                    if (response.status != "success") {
                        throw new Error("Failure to connect");
                    } else {
                        console.log("closed setup");
                    }
                });
            }
        });
    })
}

function encryptPassword(password, salt, iv) {
    var crypto = require('crypto');
    
    // TODO: ehhhhhhhhhhhh... this probably isn't exactly right

    var cipher = crypto.Cipheriv('aes-128-cbc', salt, iv);
    var encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    encrypted += encrypted.length.toString(16).substring(2) + (password.length < 16 ? '0' : '') + password.length.toString(16).substring(2);
    
    console.log("encrypted pass: " + pw);
    return encrypted;
}

function getMetaInfo(deviceInfo) {
    var device = Url.parse(deviceInfo.address);

    var options = {
        host: device.hostname,
        port: device.port,
        path: "/upnp/control/metainfo1"
    };

    return ssdp.soapRequest(options, "urn:Belkin:service:metainfo:1", "GetMetaInfo", null).then( (response) => {
        // MetaInfo: '149182CA7634|221617K0102FFD|Plugin Device|WeMo_WW_2.00.10885.PVT-OWRT-SNS|WeMo.Switch.FFD|Socket'
        var parts = response.MetaInfo.split('|'); 
        var keydata = parts[0].substring(0,6) + parts[1] + parts[0].substring(6,12); // parts[0][0:6] + parts[1] + parts[0][6:12]

        console.log(keydata);
        return {
            deviceType: parts[2],
            uuid: parts[3],
            ssid: parts[4],
            salt: keydata.substring(0,8),
            iv: keydata.substring(0, 16)
        }
    });
}

function doPairing(deviceInfo, knownAps) {
        console.log("Pairing " + deviceInfo.friendlyName);
        var ifaceState = wificontrol.getIfaceState();

        // Connect to the AP broadcast by the device
        console.log("Connecting to " + deviceInfo.controlId);
        return connectToAp(deviceInfo.controlId).then( () => {
            // 2. Now that we're on the AP, find the address of the device current controlId is the SSID name
            console.log("Searching for the device on the new network");
            return findDevice(deviceInfo).then( (newDeviceInfo) => {
                // 3. Ask the device what APs it can see.
                console.log("Found the device");
                console.log("Ask the device what access points it can see");
                return getDeviceAps(newDeviceInfo).then( (deviceAps) => {
                    // 4. Find a good AP from the list
                    var selectedAp;
                    knownAps.forEach( (knownAp) => {
                        deviceAps.forEach( (deviceAp) => {
                            if (deviceAp.ssid == knownAp.ssid) {
                                console.log("found a match");
                                selectedAp = deviceAp;
                                selectedAp.password = knownAp.password;
                                return;
                            }
                        });

                        if (selectedAp) {
                            return;
                        }
                    });

                    if (selectedAp === undefined) {
                        throw new Error("Unsupported access points, cannot pair device.");
                    }

                    console.log(JSON.stringify(selectedAp));

                    // 5. Connect the device to the new AP
                    return moveDeviceToAp(newDeviceInfo, selectedAp).then( () => {
                        // 6. Reconnect to our original network, authentication is handled by the OS
                        // as a remembered network
                        return connectToAp(ifaceState.ssid).then( () => {
                            // 7. Finally, refind the device on the real network, controlID is the unique uuid of the device
                            return findDevice(newDeviceInfo);
                        });
                    });
                });
            });
        }).catch((error) => {
            // If at any point there is an error, ensure that we move back to the original network
            return connectToAp(ifaceState.ssid).then( () => {
                throw new Error(error);
            });
        });
}

// Discover a specific device by name using ssdp
function findDevice(deviceInfo) {
    var deferred = q.defer();
    
    // TODO: this drops a delay into the detection to avoid detecting too soon after connecting to a network.
    // There's probably a better way to handle this, knowing when we've completed connecting to a network

    setTimeout(() => {
        deferred.resolve();
    }, 10000);

    return deferred.promise.then(() => {
        var ssdpDiscover = new ssdp("urn:Belkin:service:basicevent:1");
        return ssdpDiscover.discover(2000).then( devices => {
            if (devices && devices.length > 0) {
                // Overwrite the device info with the current device data (address, UUID etc.)
                // Which will be used to re-detect the device when added to the original network.
                deviceInfo.controlId = devices[0].controlId;
                deviceInfo.address = devices[0].address;
                deviceInfo.deviceType = devices[0].deviceType;
                deviceInfo.friendlyName = devices[0].friendlyName;

                return deviceInfo;
            } else {
                throw new Error("Cannot find device");
            }
        });
    });
}



/**
 * 
 */
class Onboarding {

    /**
     * Onboards WeMo Wifi devices.
     * 
     * Wemo devices require no authentication, so once added to a network, they will automatically
     * be available for use.
     * 
     * If not on the network, then they needed to be moved, and re-discovered.  The only info that
     * we know for an ad hoc wifi ssid device (non onboarded) is the SSID itself.  The current machin
     * will need to connect to that AP in order to communicate with the device, at which point more
     * data about the device specifics can be collected. This data will be used to re-discover the 
     * device and return the deviceInfo.
     */
    onboard(onboardingInfo) {
        var deviceInfo = onboardingInfo;

        if (onboardingInfo.deviceType == "Unpaired") {
            // Unpaired devices need to be paired first
            // 1. Connect to the AP
            // 2. Ask the device what AP's it supports
            // 3. Choose an AP from the onboardingFlow that the device can connect to
            // 4. Set that device as the home network
            // 5. Reconnect back to the original network
            // 6. Re-search for that specific device
            // 7. Go through normal onboarding process of the device

            return doPairing(onboardingInfo, onboardingInfo.flow.aps);
        }

        // No onboarding required for already paired devices,
        // discovery was enough to instantiate translators.
        // so the onboarding info is returned unchanged.
        deviceInfo.then((deviceInfo) => {
            return deviceInfo;
        });
    }

    /**
     * Discovers any devices on the current network using a number of different methods.  Each time a device is found
     * that is understood by opent2t, it will be onboarded and the discoveryCallback will be called with the device info
     * 
     */
    static discover(timeout, extraInfo) {
        // Find the access points that are available.
        var foundDevices = ssidDiscover(extraInfo.networks);
        console.log("Unpaired WeMo devices: " + foundDevices.length + " devices");

        var ssdpDiscover = new ssdp("urn:Belkin:service:basicevent:1");
        return ssdpDiscover.discover(timeout).then( devices => {
            console.log("Available WeMo devices: " + devices.length + " devices");
            foundDevices = foundDevices.concat(devices);
            
            // Ensure that each device knows what onboarding module to use if it needs to be onboarded
            foundDevices.forEach((device) => {
                device.onboardingModule = "opent2t-onboarding-org-opent2t-onboarding-wifi-wemo";
            });
            return foundDevices;
        });
    }    
}

module.exports = Onboarding;