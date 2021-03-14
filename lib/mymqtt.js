"use strict";
const mqtt = require("mqtt");
const moment = require("moment");
const datamodel = require("./model.js");
const propertiesReader = require('properties-reader');
const fpp_properties = propertiesReader('/home/fpp/media/settings');

var client = undefined;

var handlers = [{
        topic: "/christmas/nameQueue",
        callback: function(topic, message) {
            datamodel.lastnameQueue = moment().toDate();
            let data = JSON.parse(message.toString());
            datamodel.nameQueue = data;
            datamodel.current.nameStatus = data.status;
            if (data.status === "GENERATING") {
                datamodel.current.lastNameGen = moment().toDate();
            }
        }
    },
    {
        topic: "/christmas/vote/songQueue",
        callback: function(topic, message) {
            let songList = JSON.parse(message.toString());
            if (songList.length > 0) {
                datamodel.topVote = songList[0].playlist;
                datamodel.lastVote = moment().toDate();
            } else {
                datamodel.topVote = "";
            }
        }
    },
    {
        topic: "/christmas/vote/setShortList",
        callback: function(topic, message) {
            console.log("received ", topic);
            let data = message.toString();
            let isShort = false;
            if (data.toUpperCase() === "TRUE") {
                isShort = true;
            }
            console.log('Shortlist changed to ', isShort);
            datamodel.current.shortList = isShort;
            datamodel.internal_songs.forEach(function(s) {
                if (s.playlist === "Internal_Short_Show") {
                    s.enabled = isShort;
                    console.log(s.playlist, ' is ', s.enabled);
                }
            });

        }
    },
    {
        topic: "/christmas/scheduler/requestSongs",
        callback: function(topic, message) {
            console.log("received ", topic);
            publishPlaylist();
        }
    },
    {
        topic: "/christmas/clock",
        callback: function(topic, message) {
            let data = parseInt(message.toString());
            datamodel.clock.time = data;
            datamodel.clock.lastUpdate = moment().toDate();
            if (datamodel.clock.time > 0) {
                datamodel.clock.startedMidnight = false;
            }
        }
    },
    {
        topic: "/christmas/vote/debug",
        callback: function(topic, message) {
            let data = message.toString();
            if (data.toUpperCase() === "TRUE") {
                datamodel.current.debug = true;
            }
            if (data.toUpperCase() === "FALSE") {
                datamodel.current.debug = false;
            }
            console.log(
                "Changing debug to ",
                datamodel.current.debug,
                " because of ",
                data
            );
        }
    },
    {
        topic: "/christmas/setActive",
        callback: function(topic, message) {
            let data = message.toString();
            if (data.toUpperCase() === "TRUE") {
                datamodel.current.enabled = true;
            }
            if (data.toUpperCase() === "FALSE") {
                datamodel.current.enabled = false;
            }
            console.log(
                "Changing active status to ",
                datamodel.current.enabled,
                " because of ",
                data
            );
        }
    }
];

function sendNameAction(msg) {
    console.log("Calling Send name Action with " + msg);
    let topic = "/christmas/nameAction";
    client.publish(topic, msg, function(err) {
        if (err) {
            console.log("Error publishing topic");
            console.log(err);
        }
    });
}

/*
 * Reads a setting fromt he FPP Settings file
 */
function getFppSetting(prop) {
    let rc = fpp_properties.get(prop);
    return rc.replace(/['"]+/g, '');
}

/*
 * Publishes the current known playlist
 */
function publishPlaylist() {
    let msg = JSON.stringify(datamodel.all_playlists);
    let topic = "/christmas/scheduler/all_playlist";
    client.publish(topic, msg, function(err) {
        if (err) {
            console.log("Error publishing Playlist");
            console.log(err);
        }
    });
}

/*
 * Innitializtes the MQTT connection
 */
function init() {
    let options = {
        host: getFppSetting('MQTTHost'),
        port: getFppSetting('MQTTPort'),
        //username: getFppSetting('MQTTUsername'),
        //password: getFppSetting('MQTTPassword'),
        protocol: "mqtt",
        clientId: "sched_" + Math.random().toString(16).substr(2, 8),
        protocolId: "MQIsdp",
        protocolVersion: 3
    };
    client = mqtt.connect(options);
    client.on("connect", function() {
        console.log("MQTT Connected");
        // add handlers
        handlers.forEach(function(h) {
            console.log("Subscribing to ", h.topic);
            client.subscribe(h.topic, function(err) {
                if (err) {
                    console.log("Failed to subscribe to ", h.topic);
                }
            });
        });
    });

    client.on("message", function(topic, message) {
        let handled = false;
        handlers.forEach(function(h) {
            if (topic == h.topic) {
                h.callback(topic, message);
                handled = true;
            }
        });
        if (!handled) {
            console.log("Warning: Unabled MQTT topic: ", topic);
        }
    });
}

function sendStatus() {
    let status = "ALL_OK";
    let ts = moment().toDate();
    let lastVote = (ts - datamodel.lastVote) / 6000;
    let lastNameGen = (ts - datamodel.current.lastNameGen) / 60000;
    let lastNamePlay = (ts - datamodel.current.lastNamePlay) / 60000;
    let showRunning = datamodel.current.isDisplayHours;
    let idle_time = (ts - datamodel.current.idleDate) / 1000;
    let clock_time = (ts - datamodel.clock.lastUpdate) / 1000;

    if (idle_time > 10 && showRunning) {
        status = "SCHEDULER_IDLE_ERROR";
    } else if (lastVote > 30) {
        status = "SCHEDULER_NO_VOTE";
    } else if (lastNamePlay > 40 && showRunning) {
        status = "SCHEDULER_NAME_PLAY_ERROR";
    } else if (lastNameGen > 40 && showRunning) {
        status = "SCHEDULER_NAME_GEN_ERROR";
    } else if (clock_time > 20) {
        status = "SCHEDULER_NO_CLOCK";
    }

    datamodel.current.status = status;

    let msg = JSON.stringify(datamodel.current);
    let topic = "/christmas/scheduler/status";
    client.publish(topic, msg, function(err) {
        if (err) {
            console.log("Error publishing Status");
            console.log(err);
        }
    });
}

module.exports.init = init;
module.exports.publishPlaylist = publishPlaylist;
module.exports.sendStatus = sendStatus;
module.exports.sendNameAction = sendNameAction;