const playlist = require("./lib/playlist.js")
const scheduler = require("./lib/scheduler.js")
const mymqtt = require("./lib/mymqtt.js");

async function init() {
    mymqtt.init();
    publishPlaylist();
}

init()

async function publishPlaylist() {
    await playlist.refreshPlayList(); // Saves to data model
    mymqtt.publishPlaylist();
}

setInterval(scheduler.doScheduleCheck, 1500);
setInterval(publishPlaylist, 120000); //120 seconds