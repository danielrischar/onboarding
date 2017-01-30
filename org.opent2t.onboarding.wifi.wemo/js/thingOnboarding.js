var ssdp = require('./ssdpDiscovery');
/**
 * 
 */
class Onboarding {

    /**
     * Onboards devices to 
     */
    onboard(onboardingInfo) {
        // var onboardingInfo = {
        //     ssid: "<ssid>",
        //     password: "<wifi password>",
        //     address: [
        //           "192.168.1.27",
        // };

        // Perform onboarding for the device.
        // For Wemo, this is 

        return {onboardingInfo};
    }

    /**
     * Discovers any devices on the current network using a number of different methods.  Each time a device is found
     * that is understood by opent2t, it will be onboarded and the discoveryCallback will be called with the device info
     * 
     */
    discover(discoveryCallback, timeout) {
        // Search for WeMo devices using the Belkin Urn
        var ssdpDiscover = new ssdp("urn:Belkin:service:basicevent:1");
        return ssdpDiscover.discover(discoveryCallback, timeout);
    }    
}

module.exports = Onboarding;