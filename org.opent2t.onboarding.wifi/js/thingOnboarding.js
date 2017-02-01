var wificontrol = require('wifi-control');
var q = require('q');

/**
 * Scan for available WiFi network SSIDs
 */
function scanForWifiNetworks() {
    var deferred = q.defer();

    wificontrol.init({
        debug: false
    });

    // TODO: Concern on W10 that this doesn't show all networks unless refreshed first.
    // netsh wlan show networks has the same issue, where it wont always show what is detected.
    // I can manually refresh the list by clicking on the wifi icon on the taskbar
    wificontrol.scanForWiFi( (error, response) => {
        if (error) {
            deferred.reject(error);
        } else {
            deferred.resolve(response.networks);
        }
        
    });

    return deferred.promise;
}

/**
 * Find all installed opent2t onboarding modules (sub-onboarders) for specific protocol
 * functionality.
 * 
 *  @param {string} discoveryType - String to use in order to find modules
 *      (eg. BluetoothLE, WiFi, ZWave etc.)
 *  @return An array of module names that can be loaded for discovery and onboarding.
 *  
 */
function findDiscoveryModules(discoveryType) {
    var deferred = q.defer();
    // TODO: Use local package source to find onboarders, then regex the names vs.
    // *.wifi.<something>

    deferred.resolve([
        "opent2t-onboarding-org-opent2t-onboarding-wifi-wemo"
        //"opent2t-onboarding-org-opent2t-onboarding-wifi-flux"
    ]);

    return deferred.promise;
}

/**
 * Discovers and onboards new devices on WiFi
 */
class Onboarding {

    /**
     * Onboards devices to the network and performs any authentication setup that needs to be done.
     * 
     * @param {Object} oinboardingInfo
     * @return object that can be passed to a translator to interact with the device.
     */
    onboard(onboardingInfo) {
        // There is no generic wifi onboarding, so each device need to be delegated to a speficic onboarder
        // which should be a property on the onboarding information
        if (onboardingInfo.onboardingModule) {
            var Onboarding = require(onboardingInfo.onboardingModule);
            var onboarding = new Onboarding();
            return onboarding.onboard(onboardingInfo);
        } else {
            throw new Error("Unknown WiFi device. Cannot onboard.");
        }
    }

    /** 
     * Discovers available wifi devices using installed sub-onboarding modules
     * 
     * @param {number} timeout - Discovery timeout.  When elapsed, will return a list of all devices found.
     * @param {Object} extraInfo - Extra information used for discovery.
     * @param {Array} extraInfo.availableNetworks - A list of WiFi networks (SSID etc.) that are currently detected.
     *      if this list is not provided, or is empty then the onboarder will collect them itself.  Providing this
     *      argument prevents further WiFi discovery modules from needed to re-scan for networks, which can
     *      consume significant time.
    */
    static discover(timeout, extraInfo) {
        // Find all of the discovery modules
        return findDiscoveryModules("wifi").then( (modules) => {

            // Scan for WiFi networks now so each module doesn't need to do it
            return scanForWifiNetworks().then( (availableNetworks) => {
 
                // Use each module to discover devices that may work with it
                var discoveryPromises = modules.map( (moduleName) => {
                    var Onboarding = require(moduleName);
                    return Onboarding.discover(timeout, { "networks": availableNetworks });
                });

                return Promise.all(discoveryPromises).then( (discoveryLists) => {
                    var devicesFound = [];
                    
                    // Each discover returns an array of items, and they all need
                    // to be concatenated into a single dimensional array
                    discoveryLists.map( (discoveryList) => {;
                        devicesFound.push.apply(devicesFound, discoveryList);
                    });

                    return devicesFound;
                });
            });
        });
    }
}

module.exports = Onboarding;