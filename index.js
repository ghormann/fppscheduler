const playlist = require("./lib/playlist.js");
const scheduler = require("./lib/scheduler.js");
const tunnel = require("./lib/tunnelScheduler.js");
const mymqtt = require("./lib/mymqtt.js");

async function init() {
    mymqtt.init();
    publishPlaylist();
}

init();

async function publishPlaylist() {
    await playlist.refreshPlayList(); // Saves to data model
    mymqtt.publishPlaylist();
}

setInterval(scheduler.doScheduleCheck, 500);
setInterval(tunnel.doTunnelCheck, 500);
setInterval(scheduler.doNameCheck, 5000);
setInterval(mymqtt.sendStatus, 5000); // OK
setInterval(mymqtt.notifyPlugs, 120000); // 120 seconds
setInterval(publishPlaylist, 120000); //120 seconds
