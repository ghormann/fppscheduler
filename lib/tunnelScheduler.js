"use strict";
const dataModel = require("./model.js");
const fpplib = require("./fpp.js");
const fpp = new fpplib.FPPApi(process.env.FPP_TUNNEL);
const infoboard = new fpplib.FPPApi(process.env.FPP_TUNNEL_SIGN);

const songs = {
    Blue: ["bluey.fseq", "Clouds_Sun.fseq", "Christmas_Tree.fseq", "hex_vortax.fseq", "beach.fseq", "Fly_Through.fseq"],
    Green: ["popcorn.fseq", "Aurora.fseq", "beams.fseq", "Tie_die.fseq", "rainbow.fseq", "rainbow2.fseq"],
    Red: ["Wings", "Train.fseq"],
    White: ["merry_Christmas.fseq", "Happy_New_Year.fseq", "nice.fseq"],
    Yellow: ["Sleepy_Rays.fseq", "Warp.fseq", "liquid_fire.fseq", "Circle.fseq", "The_Matrix.fseq", "Black_Chery.fseq"],
};

const songPos = {
    Blue: 0,
    Green: 0,
    Red: 0,
    White: 0,
    Yellow: 0,
};

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function sendStatsMessage() {
    console.log(dataModel.tunnel.stats);
    let fontsize = 48;
    const sleep_dur = 31000;
    let full_message = dataModel.tunnel.stats
    dataModel.tunnel.stats = ""; // Mark we've processed it.
    await infoboard.overlaySetState(1);
    await infoboard.overlaySetText(full_message, fontsize, "R2L");
    await sleep(sleep_dur);
    await infoboard.overlayClearMessage();
    await infoboard.overlaySetState(0);
    console.log("Done");
    
}


async function sendStatsMessageOld() {
    console.log(dataModel.tunnel.stats);
    let fontsize = 48;
    const max_length = 15;
    const sleep_dur = 2000;

    let parts = dataModel.tunnel.stats.split(" ");
    dataModel.tunnel.stats = ""; // Mark we've processed it.
    let msg = "";
    await infoboard.overlaySetState(1);
    for (const p of parts) {
        if (msg.length + p.length < max_length) {
            msg += " ";
            msg += p;
        } else {
            msg = msg.trim();
            await infoboard.overlaySetText(msg, fontsize);
            await sleep(sleep_dur);
            msg = p;
        }
    }
    if (msg.length > 0) {
        msg = msg.trim();
        await infoboard.overlaySetText(msg, fontsize);
        await sleep(sleep_dur);
        msg = "";
    }
    await infoboard.overlayClearMessage();
    await infoboard.overlaySetState(0);
}

async function playNow(playlist) {
    dataModel.tunnel.lastSend = Date.now();
    fpp.playNow(playlist);
}

async function doTunnelCheck() {
    // Await 1 sec before scheduling again
    let diff = Date.now() - dataModel.tunnel.lastSend;

    if (diff < 1000) {
        return 0;
    }

    if (!dataModel.current.enabled) {
        return 0;
    }

    if (!dataModel.current.isDisplayHours) {
        return 0; // Just abort;
    }

    if (dataModel.tunnel.stats.length > 0) {
        setTimeout(sendStatsMessage, 1);
    }

    let fppStatus = await fpp.getFppStatus();
    let currentSong = fppStatus.current_playlist;

    if (currentSong.playlist == "") {
        playNow(getNextSong());
    }

    if (dataModel.tunnel.button != "") {
        playNow(getNextSong(dataModel.tunnel.button));
        dataModel.tunnel.button = "";
    }
}

function getNextSong(color) {
    const colors = Object.keys(songs);

    if (color == null || color == "" || !colors.includes(color)) {
        const randomIndex = Math.floor(Math.random() * colors.length);
        color = colors[randomIndex];
    }

    const choices = songs[color];
    songPos[color] += 1;
    if (songPos[color] >= choices.length) {
        songPos[color] = 0;
    }

    let answer = choices[songPos[color]];
    if (answer == "nice.fseq") {
       if (Math.random() > 0.6) {
	   answer = "naughty.fseq";
       }
    }

    return answer;
}

module.exports.doTunnelCheck = doTunnelCheck;
