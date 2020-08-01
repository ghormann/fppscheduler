const mqtt = require("mqtt");
const datamodel = require("./model.js");
const propertiesReader = require('properties-reader');
const fpp_properties = propertiesReader('/home/fpp/media/settings');

var client = undefined;

/*
 * Reads a setting fromt he FPP Settings file
 */
function getFppSetting(prop) {
    var rc = fpp_properties.get(prop);
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
    });

}

module.exports.init = init;
module.exports.publishPlaylist = publishPlaylist