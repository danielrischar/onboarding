var test = require('ava');
var Onboarding = require('../thingOnboarding.js');

/** Discovers bluetooth devices.  Requires an actual device to be discoverable. */
test.serial('discoverBLE', t => {
    var devices = [];
    var foundDevice = function(deviceInfo) {
        console.log(JSON.stringify(deviceInfo, null, 2));
        devices.push(deviceInfo);
    }

    var discovery = new Onboarding();
    return discovery.discover(foundDevice, 10000).then((d) => {
        t.true(devices.length > 0, "Expecting at least one BLE device");
    });
});
