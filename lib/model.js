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
    stats: "",
};

module.exports.short_show_list = ["The_Grinch", "Hippo", "Fish_Joy", "12_Days", "Hot_Chocolate", "jingle_bells_dixon", "Believe_in_Santa", "Christmas_Can_Can", "Magic"];

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

module.exports.loadOverrides = function () {
    let overrides;
    try {
        overrides = require("../override.js");
    } catch (e) {
        if (e.code === "MODULE_NOT_FOUND") return;
        console.error("[override] Failed to load override.js:", e.message);
        return;
    }

    if (Array.isArray(overrides.short_show_list) && overrides.short_show_list.every((s) => typeof s === "string")) {
        console.log(`[override] short_show_list replaced with: ${overrides.short_show_list.join(", ")}`);
        module.exports.short_show_list = overrides.short_show_list;
    }

    if (Array.isArray(overrides.internal_songs)) {
        const built = overrides.internal_songs.map((entry) => {
            const next_minutes = typeof entry.next_minutes === "number" ? entry.next_minutes : 0;
            return {
                playlist: entry.playlist,
                next: moment().add(next_minutes, "minute").toDate(),
                frequency_min: entry.frequency_min,
                enabled: entry.enabled,
            };
        });
        console.log(`[override] internal_songs replaced with: ${built.map((e) => `${e.playlist}(enabled=${e.enabled})`).join(", ")}`);
        module.exports.internal_songs = built;
    }
};

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
    song: "Unknown",
    current_sequence: "Unknown",
    seconds_remaining: 0,
    lastNameGen: moment().subtract(5, "minute").toDate(),
    lastNamePlay: moment().subtract(5, "minute").toDate(),
    isDisplayHours: false,
    idleDate: moment().toDate(),
    nameStatus: "Unknown",
    enabled: true,
    tunnelEnabled: true,
    debug: false,
    shortList: false,
};
