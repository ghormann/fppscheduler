const playlist=require("./lib/playlist.js")
const scheduler=require("./lib/scheduler.js")
const mymqtt=require("./lib/mymqtt.js");

async function init() {
   mymqtt.init();
   playlist.refreshPlayList();
}

init()

setInterval(scheduler.doScheduleCheck, 1500);
setInterval(playlist.refreshPlayList, 120000); //120 seconds
