const moment = require("moment");


// Avaiable Playlist from fpp
module.exports.all_playlists = [];

// Top voted song from Voting website
module.exports.topVote = "";

// has Good Night already been played.
module.exports.playGoodnight = false;

// The name Queue
module.exports.nameQueue = {
    low: [],
    normal: [],
    ready: [],
    status: "Unknown"
}

// Information about countdown clock
module.exports.clock = {
    time: -1,
    lastUpdate: moment().toDate()
};

module.exports.lastVote = moment().toDate();
module.exports.lastNameQueue = moment().toDate();

// My current status
module.exports.current = {
    status: "Unknown",
    lastNameGen: moment().subtract(1, "day").toDate(),
    lastNamePlay: moment().subtract(1, "day").toDate(),
    isDisplayHours: false,
    idleDate: moment().toDate(),
    nameStatus: "Unknown",
    enabled: true,
    debug: false
};