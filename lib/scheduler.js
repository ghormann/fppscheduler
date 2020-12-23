const dataModel = require('./model.js');
const moment = require("moment");
const axios = require('axios');
const mymqtt = require('./mymqtt.js');

// Function called every few sceconds
// to genereate name sequence
function doNameCheck() {
    if (!dataModel.current.isDisplayHours) {
        return
    }

    if (!dataModel.current.enabled) {
        return
    }

    // Genereate Midnight!
    if (dataModel.clock.time < 200 && dataModel.clock.time > 0) {
        if (dataModel.current.nameStatus != "PENDING_MIDNIGHT" && dataModel.current.nameStatus != "READY_MIDNIGHT") {
            console.log("Force Midnight name generation");
            mymqtt.sendNameAction("GENERATE_MIDNIGHT");
        }

        return; // Don't do other name checks
    } else if (dataModel.clock.time < 400 && dataModel.clock.time > 0) {
        return; // Don't want to mess up midnight
    }

    // 
    // Exit early and don't genereate names if song
    // has more than 60 seconds remaining
    //
    if (dataModel.seconds_remaining > 60) {
        return 0;
    }


    // If there is a name in the queue, use its date.
    // If not, use when names was last genereated
    let when = dataModel.current.lastNameGen;
    let normal_cnt = dataModel.nameQueue.normal.length;
    if (normal_cnt > 0) {
        let first = dataModel.nameQueue.normal[0];
        when = new Date(first.ts * 1000);
    }

    let diff_gen = Date.now() - dataModel.current.lastNameGen;
    let diff = Date.now() - when;
    //console.log("DEBUG: Name diff: ", diff, " ", dataModel.nameQueue.status);
    if (dataModel.nameQueue.status === "IDLE") {
        let low_cnt = dataModel.nameQueue.low.length;

        if (normal_cnt > 0 || low_cnt > 0) {
            // 9 min
            if (diff > 540000 && diff_gen > 120000) {
                console.log("Normal Generate names because of ", diff);
                mymqtt.sendNameAction("GENERATE");

                // 7 min
            } else if (normal_cnt > 9 && diff > 420000 && diff_gen > 120000) {
                console.log("7 minute genreate names ", diff, " ", normal_cnt);
                mymqtt.sendNameAction("GENERATE");

                // 4 min
            } else if (normal_cnt > 12 && diff > 240000 && diff_gen > 120000) {
                console.log("4 minute genreate names ", diff, " ", normal_cnt);
                mymqtt.sendNameAction("GENERATE");
            }

            // If no names in queue but 35 min, Generate
        } else if (diff > 2100000) {
            console.log("Genereating empty name queue after 35 min");
            mymqtt.sendNameAction("GENERATE");
        }
    }
}

function findNextInternal() {
    answer = "";
    dataModel.internal_songs.forEach(function(s) {
        if (answer === "") {
            diff = Date.now() - s.next;
            if (diff > 0 && s.enabled) {
                answer = s.playlist;
                s.next = moment().add(s.frequency_min, 'minute').toDate();
            }
        }
    });

    let now_ts = moment();

    // Add time to avoid back to back
    if (answer != "") {
        dataModel.internal_songs.forEach(function(s) {
            if (answer != s.playlist && s.enabled) {
                s.next = moment(moment.max(now_ts, moment(s.next))).add(2, 'minute').toDate();
            }
            // These two should be spaced
            if (answer === 'Internal_Intro' && s.playlist === 'Internal_Driveway') {
                s.next = moment().add(15, 'minute').toDate();
            }
            // These two should be spaced
            if (answer === 'Internal_Driveway' && s.playlist === 'Internal_Intro') {
                s.next = moment().add(15, 'minute').toDate();
            }
            console.log('DEBUG: ', s.playlist, ": ", s.next);
        });
    }

    return answer;
}

// Funciton called every 0.5 seconds
// to schedule next song
async function doScheduleCheck() {
    // Await 3 sec before scheduling again
    let diff = Date.now() - dataModel.lastSend;

    if (diff < 3000) {
        return sleep(3000);
    }

    if (!dataModel.current.enabled) {
        return sleep(100);
    }

    dataModel.current.isDisplayHours = isDisplayHours();
    if (dataModel.current.isDisplayHours) {
        dataModel.playGoodnight = true;
    }
    fppStatus = await getFppStatus();
    currentSong = fppStatus.current_playlist;

    if (currentSong.playlist == "Internal_Good_Night") {
        dataModel.playGoodnight = false;
    }

    // Do Mindnight Prep


    // Do Midnight
    if (dataModel.clock.time <= 0 && !dataModel.clock.startedMidnight && currentSong.playlist != "Internal_Midnight") {
        return playNow("Internal_Midnight");
    }

    // Generate Midnight Names

    // If Idle
    if (currentSong.count == '0' || currentSong.playlist === "Internal_off") {
        dataModel.seconds_remaining = 0;
        //
        // Check if name ready
        //
        if ("READY" === dataModel.current.nameStatus) {
            return playNow("Internal_Wish_Name");

            //
            // If in normal hours, play next vote
            //
        } else if (dataModel.current.isDisplayHours) {
            // Schedule next
            let song = findNextInternal();
            if (song != "") {
                return playNow(song);
            } else {
                return playTopVote();
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
            return playNow(song);
        } else {
            return sleep(1000);
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

    return sleep(1000);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function playNow(playlist) {
    dataModel.lastSend = Date.now();
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
module.exports.doNameCheck = doNameCheck;
