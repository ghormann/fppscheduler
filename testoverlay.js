"use strict";

const fpplib = require("./lib/fpp.js");
const infoboard = new fpplib.FPPApi("192.168.1.158");
//const infoboard = new fpplib.FPPApi("192.168.1.148");

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function test() {
    let today = 1242;
    let season = 10123;
    let popular = "White";
    let fontsize = 48;
    const max_length = 15;
    const sleep_dur = 2000;
    let full_message = "Today, there have been " + today + " buttons pressed. " + popular + " has been the most popular today. ";
    full_message += "This season, a total of " + season + " buttons have been pressed!";

    let parts = full_message.split(" ");
    let msg = "";
    await infoboard.overlaySetState(1);
    for (const p of parts) {
        if (msg.length + p.length < max_length) {
            msg += " ";
            msg += p;
        } else {
            msg = msg.trim();
            console.log(msg);
            await infoboard.overlaySetText(msg, fontsize);
            await sleep(sleep_dur);
            msg = p;
        }
    }
    if (msg.length > 0) {
        msg = msg.trim();
        console.log(msg);
        await infoboard.overlaySetText(msg, fontsize);
        await sleep(sleep_dur);
        msg = "";
    }
    await infoboard.overlayClearMessage();
    await infoboard.overlaySetState(0);
}

test();
setInterval(test, 25000);
