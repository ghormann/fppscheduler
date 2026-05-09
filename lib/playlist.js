/**
 * playlist — fetches and caches the FPP playlist catalogue.
 *
 * Queries the FPP HTTP API for all playlists, strips out Test/* and Internal/*
 * entries to produce the public-facing list, and tags each entry with a
 * `shortlist` boolean used by the voting website to filter to shorter songs.
 * The unfiltered list (including internal playlists) is also stored on the
 * data model for admin use.
 */
"use strict";
const datamodel = require("./model.js");
const axios = require("axios");
const ignore1 = /Test/i;
const ignore2 = /Internal/i;

/**
 * Fetches the full playlist catalogue from FPP and updates the data model.
 * datamodel.all_playlists  → public playlists with shortlist tags
 * datamodel.all_playlists_internal → every playlist name including Internal/*
 */
async function refreshPlayList() {
    let rc = await readPlaylist();
    datamodel.all_playlists = rc.public;
    datamodel.all_playlists_internal = rc.internal;
    console.log("After refreshing Playlist, found: ", datamodel.all_playlists.length);
}

/** Returns the current local hour (0–23). */
function getCurrentHour() {
    let myTime = new Date();
    return myTime.getHours();
}

/**
 * Removes all elements from `originalArray` that match `regex`, in-place.
 * Returns the mutated array for chaining.
 *
 * @param {string[]} originalArray
 * @param {RegExp}   regex
 */
function removeMatching(originalArray, regex) {
    let j = 0;
    while (j < originalArray.length) {
        if (regex.test(originalArray[j])) originalArray.splice(j, 1);
        else j++;
    }
    return originalArray;
}

/**
 * Fetches all playlists from FPP, splits them into public and internal lists,
 * and fetches full detail for each public playlist so it can be tagged with
 * a shortlist flag.
 *
 * @returns {{ internal: string[], public: object[] }}
 */
async function readPlaylist() {
    let url = "http://" + process.env.FPP_HOST + "/api/playlists";
    let res = await axios.get(url);
    let files = res.data;
    files.sort();
    let files_all = [...files];
    files = removeMatching(files, ignore1);
    files = removeMatching(files, ignore2);
    let rc = [];
    for (let name of files) {
        let url = "http://" + process.env.FPP_HOST + "/api/playlist/" + name;
        let res = await axios.get(url);
        let item = res.data;
        item.shortlist = datamodel.short_show_list.includes(item.name);
        rc.push(item);
    }

    return {
        internal: files_all,
        public: rc,
    };
}

module.exports.refreshPlayList = refreshPlayList;
module.exports.removeMatching = removeMatching;
