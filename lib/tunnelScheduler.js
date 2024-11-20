"use strict";
const dataModel = require("./model.js");
const fpplib = require("./fpp.js");
const fpp = new fpplib.FPPApi(process.env.FPP_TUNNEL);

const songs = {
    Blue: ["Clouds_Sun.fseq", "Christmas_Tree.fseq", "hex_vortax.fseq", "beach.fseq", "Fly_Through.fseq"],
    Green: ["popcorn.fseq", "Aurora.fseq", "beams.fseq", "Tie_die.fseq", "rainbow.fseq", "rainbow2.fseq"],
    Red: ["Wings", "Train.fseq"],
    White: ["merry_Christmas.fseq", "Happy_New_Year.fseq"],
    Yellow: ["Sleepy_Rays.fseq", "Warp.fseq", "liquid_fire.fseq", "Circle.fseq", "The_Matrix.fseq","Black_Chery.fseq"],
};

const songPos = {
    Blue: 0,
    Green: 0,
    Red: 0,
    White: 0,
    Yellow: 0,
};

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
        return 0; // Probably need more here
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

    return choices[songPos[color]];
}

module.exports.doTunnelCheck = doTunnelCheck;
