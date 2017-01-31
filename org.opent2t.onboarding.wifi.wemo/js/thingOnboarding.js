var ssdp = require('./ssdpDiscovery');
var q = require('q');
//var Regex = require('regex');

function ssidDiscover(networks) {
    var devicesFound = [];
    
    networks.forEach( (network) => {
        // Check the network name against known good networks
        if (network.ssid.startsWith("Mordor")) {
            var device = {
                friendlyName: "Wemo Switch",
                controlId: network.ssid,
                deviceType: "Wemo-Switch",
                flow: "blah flow"
            };

            devicesFound.push(device);
        }
    });

    return devicesFound;
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

        if (onboardingInfo.deviceType == "WiFi-AP") {
            doOnboardFlow(onboardingInfo);
        }

        return onboardingInfo;
    }

    /**
     * Discovers any devices on the current network using a number of different methods.  Each time a device is found
     * that is understood by opent2t, it will be onboarded and the discoveryCallback will be called with the device info
     * 
     */
    static discover(timeout, extraInfo) {
        var foundDevices = ssidDiscover(extraInfo.networks);
        console.log("Wemo APs: " + foundDevices.length + " devices");

        var ssdpDiscover = new ssdp("urn:Belkin:service:basicevent:1");
        return ssdpDiscover.discover(timeout).then( devices => {
            console.log("Wemo ssdp: " + devices.length + " devices");
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