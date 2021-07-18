"use strict";

const overlay = require("./lib/overlay.js");


async function test() {
    overlay.sendArrayNames(["Greg", "John", "Jeff", "John"]);
}

test();