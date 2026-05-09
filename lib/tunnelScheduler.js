/**
 * tunnelScheduler — controls the LED light tunnel display.
 *
 * Manages two separate FPP instances:
 *   fpp (FPP_TUNNEL)       — the tunnel's main light sequences
 *   infoboard (FPP_TUNNEL_SIGN) — a scrolling text sign for vote statistics
 *
 * Behaviour:
 *   • Physical button presses (received via MQTT as dataModel.tunnel.button)
 *     immediately queue a colour-themed sequence.
 *   • Otherwise, doTunnelCheck() advances through a per-colour round-robin
 *     playlist whenever the tunnel goes idle.
 *   • Voting stats in dataModel.tunnel.stats are scrolled across the info
 *     board sign whenever they become available.
 */
"use strict";
const dataModel = require("./model.js");
const fpplib = require("./fpp.js");
const fpp = new fpplib.FPPApi(process.env.FPP_TUNNEL);
const infoboard = new fpplib.FPPApi(process.env.FPP_TUNNEL_SIGN);
const mymqtt = require("./mymqtt.js");

const songs = {
    Blue: ["bluey.fseq", "Christmas_Tree.fseq", "hex_vortax.fseq", "beach.fseq", "Fly_Through.fseq"],
    Green: ["Aurora.fseq", "beams.fseq", "Tie_die.fseq", "rainbow.fseq", "rainbow2.fseq"],
    Red: ["Wings", "Train.fseq", "Labubu.fseq", "the_grinch.fseq", "kpop_1.fseq"],
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

/** Promise-based sleep used to pace the info board text scroll. */
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function publishButtonMapping() {
    console.log("Publishing Tunnel Button Mapping");
    mymqtt.publishButtonMapping(songs);
}

/**
 * Scrolls the full vote statistics string across the info board in a single
 * right-to-left pass.  Sleep duration is proportional to message length to
 * ensure the full text has time to scroll off screen before clearing.
 */
async function sendStatsMessage() {
    console.log(dataModel.tunnel.stats);
    const fontsize = 48;
    const full_message = dataModel.tunnel.stats
    const sleep_dur = full_message.length * 200 + 1000;
    dataModel.tunnel.stats = ""; // Mark we've processed it.
    await infoboard.overlaySetState(1);
    await infoboard.overlaySetText(full_message, fontsize, "R2L");
    await sleep(sleep_dur);
    await infoboard.overlayClearMessage();
    await infoboard.overlaySetState(0);
    console.log("Stats Done");

}


/**
 * Legacy word-by-word stats display — splits the message into short chunks and
 * shows each on the info board for a fixed duration.
 * Superseded by sendStatsMessage() which uses a single R2L scroll.
 * Kept for reference; not called in production.
 */
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

/** Starts a playlist on the tunnel FPP instance and reports the action to MQTT. */
async function playNow(playlist, reason) {
    dataModel.tunnel.lastSend = Date.now();
    await fpp.playNow(playlist, reason);
    dataModel.tunnel.lastSend = Date.now();
    mymqtt.sendFppPlayReason({
        device: "Tunnel",
        playlist: playlist,
        reason: reason
    });
}

/**
 * Main tunnel scheduling loop — called every ~0.5 s.
 * Throttles to one action per second, then in priority order:
 *   1. Schedules any pending stats message for display on the info board.
 *   2. If a button was pressed, plays that colour's next song immediately.
 *   3. If the tunnel is idle and has been for > 4 s, plays the next song.
 * Exits early if the show is disabled, tunnel is disabled, or outside display hours.
 */
async function doTunnelCheck() {
    // Await 1 sec before scheduling again
    let diff = Date.now() - dataModel.tunnel.lastSend;

    if (diff < 1000) {
        return 0;
    }

    if (!dataModel.current.enabled) {
        return 0;
    }

    if (!dataModel.current.tunnelEnabled) {
        return 0;
    }

    if (!dataModel.current.isDisplayHours) {
        return 0; // Just abort;
    }

    // If there are stats to send, schedule sending them.
    if (dataModel.tunnel.stats.length > 0) {
        setTimeout(sendStatsMessage, 100);
    }

    // If a button was pressed, play that song now and stop.
    if (dataModel.tunnel.button != "") {
        playNow(getNextSong(dataModel.tunnel.button), dataModel.tunnel.button);
        dataModel.tunnel.button = "";
        return 0;
    }

    // If nothing playing, start the next one but make sure it has been at least 2 seconds since the last song started.
    let fppStatus = await fpp.getFppStatus();
    let currentSong = fppStatus.current_playlist;

    if (currentSong.playlist == "" && diff > 4000) {
        playNow(getNextSong(), "IDLE: " + diff);
    }

}

/**
 * Returns the next song filename for the given colour, advancing through that
 * colour's playlist in a round-robin cycle.  If `color` is absent or invalid,
 * a random colour is chosen.  "nice.fseq" has a 40% chance of returning
 * "naughty.fseq" instead to add variety.
 *
 * @param {string} [color]  Button colour (Blue, Green, Red, White, Yellow)
 * @returns {string}  Filename of the next sequence to play
 */
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
module.exports.publishButtonMapping = publishButtonMapping;
module.exports.getNextSong = getNextSong;
