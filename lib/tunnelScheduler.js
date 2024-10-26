"use strict";
const dataModel = require('./model.js');
const axios = require('axios');
const mymqtt = require('./mymqtt.js');

async function doTunnelCheck() {
    // Await 3 sec before scheduling again
    let diff = Date.now() - dataModel.tunnel.lastSend;

    if (diff < 3000) {
        return 0;
    }

    if (!dataModel.current.enabled) {
        return 0;
    }

    if(!dataModel.current.isDisplayHours) {
        return 0; // Probably need more here
    }

    if (dataModel.tunnel.button != "") {
        console.log("Handle button: ", dataModel.tunnel.button);
        dataModel.tunnel.button = "";
    }
}

module.exports.doTunnelCheck = doTunnelCheck;