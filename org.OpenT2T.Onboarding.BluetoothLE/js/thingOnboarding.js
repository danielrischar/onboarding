var noble = require('noble');
var q = require('q');

class Onboarding {

    onboard() {
    }

    /** 
     * Discovers Bluetooth LE devices for onboarding.
     */
    discover(discoverCallback, timeout) {
        var deferred = q.defer();

        noble.on('stateChange', function(state) {
            if (state === 'poweredOn') {
                console.log("scanning");
                noble.startScanning();
            } else {
                noble.stopScanning();
            }
        });

        noble.on('discover', function(peripheral) {
            var advertisement = peripheral.advertisement;

            var deviceInfo = {
                address: peripheral.address,
                controlId: peripheral.id,
                friendlyName: advertisement.localName,
                serviceTypes: advertisement.serviceUuids
            }

            if (discoverCallback && typeof discoverCallback === 'function') {
                discoverCallback(deviceInfo);
            }
        }.bind(this));

        setTimeout(() => {
            noble.stopScanning();
        }, timeout);

        return deferred.promise;
    }
}

module.exports = Onboarding;