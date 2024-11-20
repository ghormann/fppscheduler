"use strict";
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
    status: "Unknown",
};

// Tunnel
module.exports.tunnel = {
    button: "",
    lastSend: moment().toDate(),
};

module.exports.short_show_list = ["The_Grinch", "Hippo", "Fish_Joy", "12_Days", "Hot_Chocolate", "jingle_bells_dixon"];

// Information about countdown clock
module.exports.clock = {
    time: -1,
    startedMidnight: false,
    startedPrep: false,
    lastUpdate: moment().toDate(),
};

module.exports.internal_songs = [
    {
        playlist: "Internal_Driveway",
        next: moment().add(15, "minute").toDate(),
        frequency_min: 25,
        enabled: true,
    },
    {
        playlist: "Internal_Donate",
        next: moment().add(1, "minute").toDate(),
        frequency_min: 15,
        enabled: true,
    },
    {
        playlist: "Internal_TuneTo",
        next: moment().add(5, "minute").toDate(),
        frequency_min: 10,
        enabled: true,
    },
    {
        playlist: "Internal_Intro",
        next: moment().toDate(),
        frequency_min: 25,
        enabled: false,
    },
    {
        playlist: "Internal_Short_Show",
        next: moment().toDate(),
        frequency_min: 10,
        enabled: false,
    },
];

module.exports.health = {
    lastVote: moment().toDate(),
    lastNameQueue: moment().toDate(),
    lastSend: moment().toDate(),
    lastTextServer: moment().toDate(),
    lastTunnel: moment().toDate(),
    lastFPPButton: moment().toDate(),
};

// My current status
module.exports.current = {
    status: "Unknown",
    admin_song: null,
    seconds_remaining: 0,
    lastNameGen: moment().subtract(1, "day").toDate(),
    lastNamePlay: moment().subtract(1, "day").toDate(),
    isDisplayHours: false,
    idleDate: moment().toDate(),
    nameStatus: "Unknown",
    enabled: true,
    debug: false,
    shortList: false,
};
