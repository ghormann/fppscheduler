"use strict";

const fpplib = require("./lib/fpp.js");
const infoboard = new fpplib.FPPApi("192.168.1.148");


function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

async function test() {
    await infoboard.overlaySetText("This is really long");
    await infoboard.overlaySetState(1);
    await sleep(10000);
    await infoboard.overlayClearMessage();
    await infoboard.overlaySetState(0);
}

test();