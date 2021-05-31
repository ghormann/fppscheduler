"use strict";
const datamodel = require("./model.js");
const axios = require('axios');
const ignore1 = /Test/i
const ignore2 = /Internal/i

async function refreshPlayList() {
    datamodel.all_playlists = await readPlaylist();
    console.log('After refreshing Playlist, found: ', datamodel.all_playlists.length);
}

function getCurrentHour() {
    let myTime = new Date().toLocaleString("en-US", {
        timeZone: "America/New_York"
    });
    myTime = new Date(myTime);
    return myTime.getHours();
}

function removeMatching(originalArray, regex) {
    let j = 0;
    while (j < originalArray.length) {
        if (regex.test(originalArray[j]))
            originalArray.splice(j, 1);
        else
            j++;
    }
    return originalArray;
}

async function readPlaylist() {
    let url = "http://" + process.env.FPP_HOST + "/api/playlists";
    let res = await axios.get(url);
    let files = res.data;
    files = removeMatching(files, ignore1);
    files = removeMatching(files, ignore2);
    let rc = [];
    for (let name of files)
    {
       let url = "http://" + process.env.FPP_HOST + "/api/playlist/" + name;
       let res = await axios.get(url);
       let item = res.data;
       item.shortlist = datamodel.short_show_list.includes(item.name);
       rc.push(item);
    }

    return rc;
}

module.exports.refreshPlayList = refreshPlayList;
