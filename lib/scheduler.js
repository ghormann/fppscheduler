"use strict";
const dataModel = require("./model.js");
const moment = require("moment");
const mymqtt = require("./mymqtt.js");
const fpplib = require("./fpp.js");
const { default: mqtt } = require("mqtt");

const fpp = new fpplib.FPPApi(process.env.FPP_HOST);

function setNameEstimate(seconds, msg) {
    if (seconds < 0) {
        seconds = 0;
        msg = "Unable to estimate";
    }
    if (dataModel.current.song === "Internal_Wish_Name") {
        seconds = 0;
        msg = "Now";
    }
    
    if (msg == null) {
        if (seconds < 60) {
            msg = "about " + seconds + " seconds";
        } else {
            let minutes = Math.round(seconds/60);
            msg = "about " + minutes + " minutes";
        }
    }

    mymqtt.sendNameEstimates({
        estimated_seconds: seconds,
        message: msg
    });
}

// Function called every few sceconds
// to genereate name sequence
function doNameCheck() {
    if (!dataModel.current.isDisplayHours) {
        setNameEstimate(0, "10 minutes after show starts");
        return 0;
    }

    if (!dataModel.current.enabled) {
        setNameEstimate(0, "Show is disabled");
        return 0;
    }

    // Genereate Midnight!
    if (dataModel.clock.time < 150 && dataModel.clock.time > 0) {
        setNameEstimate(dataModel.clock.time);
        if (dataModel.current.nameStatus != "PENDING_MIDNIGHT" && dataModel.current.nameStatus != "READY_MIDNIGHT") {
            console.log("Force Midnight name generation");
            mymqtt.sendNameAction("GENERATE_MIDNIGHT");
        }

        return; // Don't do other name checks
    } else if (dataModel.clock.time < 400 && dataModel.clock.time > 0) {
        setNameEstimate(dataModel.clock.time);
        return; // Don't want to mess up midnight
    }

    if (dataModel.current.nameStatus != "IDLE") {
        setNameEstimate(dataModel.seconds_remaining);
    }

    // If there is a name in the queue, use its date.
    // If not, use when names was last genereated
    let when = dataModel.current.lastNameGen;
    let normal_cnt = dataModel.nameQueue.normal.length;
    if (normal_cnt > 0) {
        let first = dataModel.nameQueue.normal[0];
        when = new Date(first.ts * 1000);
    }

    let diff_gen = Math.max(Date.now() - dataModel.current.lastNameGen, Date.now()- dataModel.current.lastNamePlay);
    let diff = Date.now() - when;
   
    if (dataModel.nameQueue.status === "IDLE") {
        let low_cnt = dataModel.nameQueue.low.length;
        let max_dur = 540000; // 9 minutes
        if (normal_cnt > 9) {
            max_dur = 420000; // 7 minutes
        } 
        if (normal_cnt > 12) {
            max_dur = 240000; // 4 minutes
        }
        // console.log('--------------------------------------');
        // console.log("DEBUG: Name diff: ", diff, " ", dataModel.nameQueue.status);
        // console.log(max_dur - diff);
        // console.log(120000 - diff_gen);
        // console.log(dataModel.seconds_remaining * 1000);
        // console.log("diff_gen: ", diff_gen)
        // console.log("max_dur: ", max_dur)
        // console.log('--------------------------------------');
        let name_estimate = Math.round(Math.max(max_dur - diff, 120000 - diff_gen, dataModel.seconds_remaining * 1000) /1000);
        if (normal_cnt == 0 && low_cnt == 0) {
            name_estimate = Math.max(Math.round((2100000 - diff)/1000), dataModel.seconds_remaining);
        }
        setNameEstimate(name_estimate);

        if (normal_cnt > 0 || low_cnt > 0) {
            if (diff > max_dur && diff_gen > 120000 && (dataModel.seconds_remaining < 60) ) {
                console.log("Normal Generate names because of ", diff, max_dur);
                mymqtt.sendNameAction("GENERATE");
            }

            // If no names in queue but 35 min, Generate
        } else if (diff > 2100000 && (dataModel.seconds_remaining < 60) ) {
            console.log("Generating empty name queue after 35 min");
            mymqtt.sendNameAction("GENERATE");
        }
    }
}

function findNextInternal() {
    let answer = "";
    dataModel.internal_songs.forEach(function (s) {
        if (answer === "") {
            let diff = Date.now() - s.next;
            if (diff > 0 && s.enabled) {
                answer = s.playlist;
                s.next = moment().add(s.frequency_min, "minute").toDate();
            }
        }
    });

    let now_ts = moment();

    // Add time to avoid back to back
    if (answer != "") {
        dataModel.internal_songs.forEach(function (s) {
            if (answer != s.playlist && s.enabled) {
                s.next = moment(moment.max(now_ts, moment(s.next)))
                    .add(2, "minute")
                    .toDate();
            }
            // These two should be spaced
            if (answer === "Internal_Intro" && s.playlist === "Internal_Driveway") {
                s.next = moment().add(15, "minute").toDate();
            }
            // These two should be spaced
            if (answer === "Internal_Driveway" && s.playlist === "Internal_Intro") {
                s.next = moment().add(15, "minute").toDate();
            }
            console.log("DEBUG: ", s.playlist, ": ", s.next.toLocaleString("en-US", { timeStyle: "long" }));
        });
    }

    return answer;
}

// Funciton called every 0.5 seconds
// to schedule next song
async function doScheduleCheck() {
    // Await 3 sec before scheduling again
    let diff = Date.now() - dataModel.health.lastSend;

    if (diff < 3000) {
        return 0;
    }

    if (!dataModel.current.enabled) {
        return 0;
    }

    dataModel.current.isDisplayHours = isDisplayHours();
    if (dataModel.current.isDisplayHours) {
        dataModel.playGoodnight = true;
    }
    let fppStatus = await fpp.getFppStatus();
    let currentSong = fppStatus.current_playlist;
    dataModel.current.song = currentSong.playlist;

    if (currentSong.playlist == "Internal_Good_Night") {
        dataModel.playGoodnight = false;
    }

    // Do Mindnight Prep

    // Do Midnight
    if (dataModel.clock.time <= 0 && !dataModel.clock.startedMidnight && currentSong.playlist != "Internal_Midnight") {
        playNow("Internal_Midnight");
        return 0;
    }

    // Generate Midnight Names

    // If Idle
    if (currentSong.count == "0" || currentSong.playlist === "Internal_off") {
        dataModel.seconds_remaining = 0;

        //
        // Play Admin
        //
        if (dataModel.current.admin_song) {
            playNow(dataModel.current.admin_song);
            dataModel.current.admin_song = null;
            return 0;
        }

        //
        // Check if name ready
        //
        if ("READY" === dataModel.current.nameStatus) {
            playNow("Internal_Wish_Name");
            return 0;

            //
            // If in normal hours, play next vote
            //
        } else if (dataModel.current.isDisplayHours) {
            // Schedule next
            let song = findNextInternal();
            if (song != "") {
                playNow(song);
                return 0;
            } else {
                playTopVote();
                return 0;
            }

            //
            // Play Good night
            //

            //
            // play off
            //
        } else if (currentSong.playlist != "Internal_off") {
            let song = "Internal_off";
            if (dataModel.playGoodnight) {
                song = "Internal_Good_Night";
            }
            playNow(song);
            return 0;
        } else {
            return 0;
        }
    } else {
        // If NOT Idle
        dataModel.seconds_remaining = fppStatus.seconds_remaining;
        dataModel.current.idleDate = moment().toDate();
        if (currentSong.playlist === "Internal_Wish_Name") {
            dataModel.current.lastNamePlay = moment().toDate();
            if ("READY" === dataModel.current.nameStatus) {
                mymqtt.sendNameAction("RESET");
            }
        } else if (currentSong.playlist === "Internal_Midnight") {
            dataModel.clock.startedMidnight = true;
            if ("READY_MIDNIGHT" === dataModel.current.nameStatus) {
                mymqtt.sendNameAction("RESET");
            }
        }
    }

    return 0;
}

async function playNow(playlist) {
    dataModel.health.lastSend = Date.now();
    fpp.playNow(playlist);
    mymqtt.notifyPlugs();
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

//TODO: Move to use MQTT from clock
function isDisplayHours() {
    let myTime = new Date();
    let hour = myTime.getHours();
    let month = myTime.getMonth() + 1;
    let day = myTime.getDate();

    //console.log("Month: ", month, ", Day: ", day, ", Hour: ", hour, myTime.getMinutes());

    if (month === 12 && day === 24 && hour > 17) {
        return true;
    }

    if (month === 12 && day === 31 && hour > 17) {
        return true;
    }

    if (dataModel.current.debug) {
        return true;
    }

    if (month === 12 && day === 25 && hour < 1) {
        return true;
    }

    if (month === 1 && day === 1 && hour < 1) {
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

module.exports.isDisplayHours = isDisplayHours;
module.exports.doScheduleCheck = doScheduleCheck;
module.exports.playTopVote = playTopVote;
module.exports.doNameCheck = doNameCheck;
