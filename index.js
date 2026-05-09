const model = require("./lib/model.js");
const playlist = require("./lib/playlist.js");
const scheduler = require("./lib/scheduler.js");
const tunnel = require("./lib/tunnelScheduler.js");
const mymqtt = require("./lib/mymqtt.js");
const stateCache = require("./lib/stateCache.js");

model.loadOverrides();
stateCache.load();

async function init() {
    mymqtt.init();
    publishPlaylist();
}

init();

async function publishPlaylist() {
    await playlist.refreshPlayList(); // Saves to data model
    mymqtt.publishPlaylist();
    tunnel.publishButtonMapping();
}

stateCache.startPeriodicSave();

process.on("SIGTERM", function () {
    console.log("[stateCache] SIGTERM received, saving state before exit");
    stateCache.save();
    process.exit(0);
});

process.on("SIGINT", function () {
    console.log("[stateCache] SIGINT received, saving state before exit");
    stateCache.save();
    process.exit(0);
});

setInterval(scheduler.doScheduleCheck, 500);
setInterval(tunnel.doTunnelCheck, 500);
setInterval(scheduler.doNameCheck, 1000);
setInterval(mymqtt.sendStatus, 5000); // OK
setInterval(mymqtt.notifyPlugs, 120000); // 120 seconds
setInterval(publishPlaylist, 120000); //120 seconds
setInterval(tunnel.publishButtonMapping, 120000); //120 seconds
