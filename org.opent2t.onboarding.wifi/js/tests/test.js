var test = require('ava');
var Onboarding = require("../thingOnboarding");

test.serial('discoverDevices', t => {
    
    return Onboarding.discover(3000).then((devices) => {
        console.log(JSON.stringify(devices, null, 2));
        var onboarder = new Onboarding();
        return onboarder.onboard(devices[0]);
    });
});