"use strict";
const basedir = "/home/fpp/media/playlists/"
const glob = require('glob');
const fs = require('fs');
const datamodel = require("./model.js");
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

function readPlaylist() {
    return new Promise(function(resolve, reject) {
        glob(basedir + '*.json', function(err, files) {
            if (err) {
                console.log(err);
                reject(err);
            } else {
                let rc = [];
                files = removeMatching(files, ignore1);
                files = removeMatching(files, ignore2);

                files.forEach(function(f) {
                    fs.readFile(f, (err, data) => {
                        if (err) {
                            reject(err)
                        } else {
                            let item = JSON.parse(data);
                            item.shortlist = datamodel.short_show_list.includes(item.name);
                            rc.push(item)
                            if (rc.length === files.length) {
                                resolve(rc)
                            }
                        }
                    });
                });
            }
        });
    });
}

module.exports.readPlaylist = readPlaylist;
module.exports.refreshPlayList = refreshPlayList;