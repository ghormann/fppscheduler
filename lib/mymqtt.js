"use strict";
const mqtt = require("mqtt");
const process = require("process");
const mqttPattern = require("mqtt-pattern");
const moment = require("moment");
const datamodel = require("./model.js");

var client = undefined;
const fpp_last = {};

var handlers = [
    {
        topic: "/christmas/nameQueue",
        callback: function (topic, message) {
            datamodel.health.lastnameQueue = moment().toDate();
            let data = JSON.parse(message.toString());
            datamodel.nameQueue = data;
            datamodel.current.nameStatus = data.status;
            if (data.status === "GENERATING") {
                datamodel.current.lastNameGen = moment().toDate();
            }
        },
    },
    {
        topic: "/christmas/vote/songQueue",
        callback: function (topic, message) {
            let songList = JSON.parse(message.toString());
            if (songList.length > 0) {
                datamodel.topVote = songList[0].playlist;
                datamodel.health.lastVote = moment().toDate();
            } else {
                datamodel.topVote = "";
            }
        },
    },
    {
        topic: "/christmas/vote/setShortList",
        callback: function (topic, message) {
            console.log("received ", topic);
            let data = message.toString();
            let isShort = false;
            if (data.toUpperCase() === "TRUE") {
                isShort = true;
            }
            console.log("Shortlist changed to ", isShort);
            datamodel.current.shortList = isShort;
            datamodel.internal_songs.forEach(function (s) {
                if (s.playlist === "Internal_Short_Show") {
                    s.enabled = isShort;
                    console.log(s.playlist, " is ", s.enabled);
                }
            });
        },
    },
    {
        topic: "/christmas/scheduler/requestSongs",
        callback: function (topic, message) {
            console.log("received ", topic);
            publishPlaylist();
        },
    },
    {
        topic: "/christmas/scheduler/setAdminSong",
        callback: function (topic, message) {
            console.log("received ", topic);
            datamodel.current.admin_song = message.toString();
        },
    },
    {
        topic: "/christmas/clock",
        callback: function (topic, message) {
            let data = parseInt(message.toString());
            datamodel.clock.time = data;
            datamodel.clock.lastUpdate = moment().toDate();
            if (datamodel.clock.time > 0) {
                datamodel.clock.startedMidnight = false;
            }
        },
    },
    {
        topic: "/christmas/namechecker/health",
        callback: function (topic, message) {
            datamodel.health.lastTextServer = moment().toDate();
        },
    },
    {
        topic: "/christmas/falcon/player/+/fppd_status",
        callback: function (topic, message) {
            let parts = topic.split("/");
            let playerId = parts[4];
            fpp_last[playerId] = moment().toDate();
        },
    },
    {
        topic: "/christmas/falcon/player/FPPTunnel1/#",
        callback: function (topic, message) {
            datamodel.health.lastTunnel = moment().toDate();
        },
    },
    {
        topic: "/christmas/falcon/player/FPPButton/#",
        callback: function (topic, message) {
            datamodel.health.lastFPPButton = moment().toDate();
        },
    },
    {
        topic: "/christmas/vote/debug",
        callback: function (topic, message) {
            let data = message.toString();
            if (data.toUpperCase() === "TRUE") {
                datamodel.current.debug = true;
            }
            if (data.toUpperCase() === "FALSE") {
                datamodel.current.debug = false;
            }
            console.log("Changing debug to ", datamodel.current.debug, " because of ", data);
        },
    },
    {
        topic: "/christmas/vote/stats",
        callback: function (topic, message) {
            let data = JSON.parse(message.toString());
            let today_total = 0;
            let season_total = 0;
            let popular = "White";
            let popular_cnt = 0;

            if ("topButton_12hr" in data) {
                for (const button of data["topButton_12hr"]) {
                    let cnt = parseInt(button["cnt"]);
                    today_total += cnt;
                    if (cnt > popular_cnt) {
                        popular = button["button"];
                        popular_cnt = cnt;
                    }
                }
            }

            if ("topButton_year" in data) {
                for (const button of data["topButton_year"]) {
                    season_total += parseInt(button["cnt"]);
                }
            }
            let full_message = "Today, there have been " + today_total + " buttons pressed. " + popular + " has been the most popular today. ";
            full_message += "This season, a total of " + season_total + " buttons have been pressed!";
            datamodel.tunnel.stats = full_message;
        },
    },
    {
        topic: "/christmas/setActive",
        callback: function (topic, message) {
            let data = message.toString();
            if (data.toUpperCase() === "TRUE") {
                datamodel.current.enabled = true;
            }
            if (data.toUpperCase() === "FALSE") {
                datamodel.current.enabled = false;
            }
            console.log("Changing active status to ", datamodel.current.enabled, " because of ", data);
        },
    },
    {
        topic: "/christmas/FPPButton/#",
        callback: function (topic) {
            let parts = topic.split("/");
            let color = parts[3];
            datamodel.tunnel.button = color;
            console.log(topic, color);
        },
    },
];

function sendNameAction(msg) {
    console.log("Calling Send name Action with " + msg);
    let topic = "/christmas/nameAction";
    client.publish(topic, msg, function (err) {
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
    return rc.replace(/['"]+/g, "");
}

/*
 * Pubish button mapping
 */

 function publishButtonMapping(mapping) {
    let msg = JSON.stringify(mapping);
    let topic = "/christmas/scheduler/button_mapping";
    const options = { qos: 0, retain: true };
    client.publish(topic, msg, options, function (err) {
        if (err) {
            console.log("Error publishing Button Mapping");
            console.log(err);
        }
    });
 }

/*
 * Publishes the current known playlist
 */
function publishPlaylist() {
    let msg = JSON.stringify(datamodel.all_playlists);
    let topic = "/christmas/scheduler/all_playlist";
    client.publish(topic, msg, function (err) {
        if (err) {
            console.log("Error publishing Playlist");
            console.log(err);
        }
    });

    msg = JSON.stringify(datamodel.all_playlists_internal);
    topic = "/christmas/scheduler/all_playlist_internal";
    client.publish(topic, msg, function (err) {
        if (err) {
            console.log("Error publishing Playlist Internal");
            console.log(err);
        }
    });
}

/*
 * Innitializtes the MQTT connection
 */
function init() {
    let options = {
        host: process.env.MQTT_HOST,
        port: process.env.MQTT_PORT,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        protocol: "mqtt",
        clientId: "sched_" + Math.random().toString(16).substr(2, 8),
        protocolId: "MQIsdp",
        protocolVersion: 3,
    };

    // Validate required environment variables
    const requiredEnvVars = ['MQTT_HOST', 'MQTT_PORT', 'MQTT_USERNAME', 'MQTT_PASSWORD'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    console.log("Connecting to MQTT Broker at " + options.host + ":" + options.port  + " with username " + options.username );

    client = mqtt.connect(options);
    client.on("connect", function () {
        console.log("MQTT Connected");
        // add handlers
        handlers.forEach(function (h) {
            console.log("Subscribing to ", h.topic);
            client.subscribe(h.topic, function (err) {
                if (err) {
                    console.log("Failed to subscribe to ", h.topic);
                }
            });
        });
    });

    client.on("message", function (topic, message) {
        let handled = false;
        handlers.forEach(function (h) {
            if (mqttPattern.matches(h.topic, topic)) {
                h.callback(topic, message);
                handled = true;
            }
        });
        if (!handled) {
            console.log("Warning: Unhandled MQTT topic: ", topic);
        }
    });
}

function notifyPlugs() {
    let status = "off";
    if (datamodel.current.isDisplayHours) {
        status = "on";
    }
    let plugs = ["plug-radio", "plug-buttons", "plug-aux1", "plug-aux2"];

    for (const plug of plugs) {
        let topic = plug + "/command/switch:0";
        client.publish(topic, status, function (err) {
            if (err) {
                console.log("Error publishing to plug: " + topic);
                console.log(err);
            }
        });
    }
}

function sendStatus() {
    let status = [];
    let ts = moment().toDate();
    let lastVote = (ts - datamodel.health.lastVote) / 6000;
    let lastNameGen = (ts - datamodel.current.lastNameGen) / 60000;
    let lastNamePlay = (ts - datamodel.current.lastNamePlay) / 60000;
    let showRunning = datamodel.current.isDisplayHours;
    let idle_time = (ts - datamodel.current.idleDate) / 1000;
    let clock_time = (ts - datamodel.clock.lastUpdate) / 1000;
    let last_text_server = (ts - datamodel.health.lastTextServer) / 1000;
    let last_tunnel = (ts - datamodel.health.lastTunnel) / 1000;
    let last_button = (ts - datamodel.health.lastFPPButton) / 1000;
    let last_name_queue = (ts - datamodel.health.lastnameQueue) / 1000;

    if (process.uptime() < 60) {
        status.push("SCHEDULER_RECENT_CRASH");
    }
    if (last_name_queue > 35) {
        status.push("SCHEDULER_NO_NAME_QUEUE");
    }
    if (idle_time > 10 && showRunning) {
        status.push("SCHEDULER_IDLE_ERROR");
    }
    if (lastVote > 30) {
        status.push("SCHEDULER_NO_VOTE");
    }
    if (lastNamePlay > 45 && showRunning) {
        status.push("SCHEDULER_NAME_PLAY_ERROR");
    }
    if (lastNameGen > 45 && showRunning) {
        status.push("SCHEDULER_NAME_GEN_ERROR");
    }
    if (clock_time > 20) {
        status.push("SCHEDULER_NO_CLOCK");
    }
    if (last_text_server > 90) {
        status.push("SCHEDULER_NO_TEXT_SERVER");
    }
    if (last_tunnel > 30) {
        status.push("SCHEDULER_NO_TUNNEL");
    }
    if (last_button > 30) {
        status.push("SCHEDULER_NO_BUTTON");
    }

    for (const playerId in fpp_last) {
        let last = (ts - fpp_last[playerId]) / 1000;
        if (last > 180) {
            status.push("SCHEDULER_NO_FPP_" + playerId);
        }
        //console.log("FPP Player ", playerId, " last seen ", last, " seconds ago");
    }

    let status_msg = "ALL_OK";
    if (status.length > 0) {
        status_msg = status.join(",");
        console.log("Status Error: ", status_msg);
    }

    datamodel.current.status = status_msg;

    let msg = JSON.stringify(datamodel.current);
    let topic = "/christmas/scheduler/status";
    client.publish(topic, msg, function (err) {
        if (err) {
            console.log("Error publishing Status");
            console.log(err);
        }
    });
}

function sendFppPlayReason(data) {

    let msg = JSON.stringify(data);
    let topic = "/christmas/scheduler/fpp_playlist_action";
    client.publish(topic, msg, function (err) {
        if (err) {
            console.log("Error publishing FPP Play Reason");
            console.log(err);
        }
    });
}

function sendNameEstimates(data) {

    let msg = JSON.stringify(data);
    let topic = "/christmas/scheduler/name_estimate";
    client.publish(topic, msg, function (err) {
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
module.exports.notifyPlugs = notifyPlugs;
module.exports.sendNameEstimates = sendNameEstimates;
module.exports.sendFppPlayReason = sendFppPlayReason;
module.exports.publishButtonMapping = publishButtonMapping;
