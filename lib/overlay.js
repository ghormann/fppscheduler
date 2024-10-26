"use strict";
const axios = require("axios");
const OVERLAY_IP = "192.168.1.148";
const MODEL_NAME = "LED Panels";

/*
 * Clear the Overlay Buffer
 */
async function clearMessage() {
    let url = "http://" + OVERLAY_IP + "/api/overlays/model/" + encodeURIComponent(MODEL_NAME) + "/clear";
    return await axios.get(url);
}

/*
 * Set the state (0 = off, 1 = on, 2 = overlay)
 */
async function setState(newState) {
    let url = "http://" + OVERLAY_IP + "/api/overlays/model/" + encodeURIComponent(MODEL_NAME) + "/state";
    let msg = {
        State: newState,
    };
    return await axios.put(url, JSON.stringify(msg));
}

async function sendArrayNames(names) {
    setState(2);
    let delay = 100;
    for (const name of names) {
        setTimeout(sendName, delay, name);
        delay += 2000;
    }

    setTimeout(clearMessage, 10000);
}

/*
 * Center name in Screen
 */
async function sendName(name) {
    let url = "http://" + OVERLAY_IP + "/api/overlays/model/" + encodeURIComponent(MODEL_NAME) + "/text";
    let msg = {
        Message: name || "Test",
        Position: "Center",
        Font: "Helvetica",
        FontSize: 24,
        AntiAlias: false,
        PixelsPerSecond: 5,
        Color: "#FFFFFF",
        AutoEnable: false,
    };

    return await axios.put(url, JSON.stringify(msg));
}

module.exports.clearMessage = clearMessage;
module.exports.sendName = sendName;
module.exports.setState = setState;
module.exports.sendArrayNames = sendArrayNames;
