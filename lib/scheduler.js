const dataModel = require('./model.js');
const moment = require("moment");
const axios = require('axios');
const mymqtt = require('./mymqtt.js');

async function doScheduleCheck() {
    dataModel.current.isDisplayHours = isDisplayHours();
    fppStatus = await getFppStatus();
    currentSong = fppStatus.current_playlist;

    // Do Mindnight Prep


    // Do Midnight

    // Generate Midnight Names

    // If Idle
    if (currentSong.count == '0') {
        // Check if name ready
        if ("READY" === dataModel.current.nameStatus) {
            return playNow("Internal_Wish_Name");
        } else {
            // Schedule next
            await playTopVote();
        }
    } else {
        dataModel.current.idleDate = moment().toDate();
        if (currentSong.playlist === "Internal_Wish_Name") {
            if ("READY" === dataModel.current.nameStatus) {
                mymqtt.sendNameAction("RESET");
            }
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function playNow(playlist) {
    console.log('Starting :', playlist);
    let url = "http://localhost/api/playlist/" + playlist + "/start";
    let res = await axios.get(url);
    await sleep(1000); // Make take a second to schedule
    return res.data;
}

async function playTopVote() {
    // Assign Random.
    let pos = getRandomInt(dataModel.all_playlists.length);
    let song = dataModel.all_playlists[pos].name;

    if (dataModel.topVote.length > 0) {
        song = dataModel.topVote;
        dataModel.topVote = "";
    }
    return playNow(song);
}


function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}

/*
 * Returns the curren fpp status
 */
async function getFppStatus() {
    let res = await axios.get("http://localhost/api/fppd/status");
    return res.data;
}


function isDisplayHours() {
    let myTime = new Date().toLocaleString("en-US", {
        timeZone: "America/New_York"
    });
    myTime = new Date(myTime);
    let hour = myTime.getHours();
    let month = myTime.getMonth() + 1;
    let day = myTime.getDate();

    if (month === 12 && day === 24 && hour > 17) {
        return true;
    }

    if (month === 12 && day === 31 && hour > 17) {
        return true;
    }

    if (dataModel.current.debug) {
        return true;
    }

    if (month === 12 && day === 25 && hour < 2) {
        return true;
    }

    if (month === 1 && day === 1 && hour < 2) {
        return true;
    }

    if (hour >= 6 && hour < 9) {
        return true;
    }

    if (hour >= 17 && hour < 23) {
        return true;
    }

    return false;
}

//Scheduler URL: http://192.168.6.3/api/fppd/status

module.exports.isDisplayHours = isDisplayHours;
module.exports.doScheduleCheck = doScheduleCheck;
module.exports.playTopVote = playTopVote;