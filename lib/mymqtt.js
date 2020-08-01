const mqtt = require("mqtt");
const datamodel = require("./model.js");
const propertiesReader = require('properties-reader');
const fpp_properties = propertiesReader('/home/fpp/media/settings');

var client = undefined;

function getFppSetting(prop) {
   var rc = fpp_properties.get(prop);
   return rc.replace(/['"]+/g, '');
}

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

module.exports.init=init;
