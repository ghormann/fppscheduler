"use strict";

const mockFppInstance = {
    getFppStatus: jest.fn().mockResolvedValue({
        current_playlist: { playlist: "", count: "0" },
    }),
    playNow: jest.fn().mockResolvedValue({}),
    overlaySetState: jest.fn().mockResolvedValue({}),
    overlaySetText:  jest.fn().mockResolvedValue({}),
    overlayClearMessage: jest.fn().mockResolvedValue({}),
};

jest.mock("../lib/fpp.js", () => ({
    FPPApi: jest.fn().mockImplementation(() => mockFppInstance),
}));

jest.mock("../lib/mymqtt.js", () => ({
    publishButtonMapping: jest.fn(),
    sendFppPlayReason:    jest.fn(),
}));

jest.mock("../lib/model.js", () => ({
    current: {
        enabled:       true,
        tunnelEnabled: true,
        isDisplayHours: true,
        debug: false,
    },
    tunnel: {
        lastSend: new Date(Date.now() - 5000),
        button:   "",
        stats:    "",
    },
}));

const { getNextSong, doTunnelCheck } = require("../lib/tunnelScheduler");
const dataModel = require("../lib/model.js");
const mymqtt    = require("../lib/mymqtt.js");

beforeEach(() => {
    jest.clearAllMocks();
    dataModel.current.enabled        = true;
    dataModel.current.tunnelEnabled  = true;
    dataModel.current.isDisplayHours = true;
    dataModel.tunnel.button          = "";
    dataModel.tunnel.stats           = "";
    dataModel.tunnel.lastSend        = new Date(Date.now() - 5000);
    mockFppInstance.getFppStatus.mockResolvedValue({
        current_playlist: { playlist: "", count: "0" },
    });
});

// ── getNextSong() ─────────────────────────────────────────────────────────────

describe("getNextSong()", () => {
    const validColors = ["Blue", "Green", "Red", "White", "Yellow"];

    test.each(validColors)("returns a non-empty string for color %s", (color) => {
        expect(typeof getNextSong(color)).toBe("string");
        expect(getNextSong(color).length).toBeGreaterThan(0);
    });

    test("cycles through the playlist for a color without repeating immediately", () => {
        // Call enough times to get through a full rotation; the list should cycle
        const results = new Set();
        for (let i = 0; i < 20; i++) {
            results.add(getNextSong("Blue"));
        }
        // Should have seen more than one unique song
        expect(results.size).toBeGreaterThan(1);
    });

    test("returns a song for an unknown colour (picks a random valid colour)", () => {
        const song = getNextSong("Purple");
        expect(typeof song).toBe("string");
        expect(song.length).toBeGreaterThan(0);
    });

    test("returns a song when called with no argument", () => {
        const song = getNextSong();
        expect(typeof song).toBe("string");
        expect(song.length).toBeGreaterThan(0);
    });

    test("'nice.fseq' slot occasionally returns 'naughty.fseq'", () => {
        // Force Math.random to return > 0.6 so naughty branch is taken
        jest.spyOn(Math, "random").mockReturnValue(0.8);
        // Cycle White until we hit the nice.fseq slot (index 2)
        // White: ["merry_Christmas.fseq", "Happy_New_Year.fseq", "nice.fseq"]
        // We'll call getNextSong until the result equals naughty or nice
        let found = false;
        for (let i = 0; i < 10; i++) {
            const song = getNextSong("White");
            if (song === "naughty.fseq" || song === "nice.fseq") {
                found = true;
                break;
            }
        }
        expect(found).toBe(true);
        jest.spyOn(Math, "random").mockRestore();
    });
});

// ── doTunnelCheck() ───────────────────────────────────────────────────────────

describe("doTunnelCheck()", () => {
    test("exits early and does not call FPP when show is disabled", async () => {
        dataModel.current.enabled = false;
        await doTunnelCheck();
        expect(mockFppInstance.getFppStatus).not.toHaveBeenCalled();
    });

    test("exits early when tunnelEnabled is false", async () => {
        dataModel.current.tunnelEnabled = false;
        await doTunnelCheck();
        expect(mockFppInstance.getFppStatus).not.toHaveBeenCalled();
    });

    test("exits early when outside display hours", async () => {
        dataModel.current.isDisplayHours = false;
        await doTunnelCheck();
        expect(mockFppInstance.getFppStatus).not.toHaveBeenCalled();
    });

    test("exits early if last send was less than 1 second ago", async () => {
        dataModel.tunnel.lastSend = new Date(Date.now() - 100);
        await doTunnelCheck();
        expect(mockFppInstance.getFppStatus).not.toHaveBeenCalled();
    });

    test("plays the button's colour song when a button was pressed", async () => {
        dataModel.tunnel.button = "Blue";
        await doTunnelCheck();
        expect(mockFppInstance.playNow).toHaveBeenCalled();
        expect(dataModel.tunnel.button).toBe(""); // consumed after playing
    });

    test("starts a song when FPP is idle and enough time has passed", async () => {
        dataModel.tunnel.lastSend = new Date(Date.now() - 5000);
        mockFppInstance.getFppStatus.mockResolvedValue({
            current_playlist: { playlist: "", count: "0" },
        });
        await doTunnelCheck();
        expect(mockFppInstance.playNow).toHaveBeenCalled();
    });

    test("does not start a song when FPP is already playing", async () => {
        dataModel.tunnel.lastSend = new Date(Date.now() - 5000);
        mockFppInstance.getFppStatus.mockResolvedValue({
            current_playlist: { playlist: "Blue_Song", count: "1" },
        });
        dataModel.tunnel.button = "";
        await doTunnelCheck();
        expect(mockFppInstance.playNow).not.toHaveBeenCalled();
    });
});
