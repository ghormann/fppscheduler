"use strict";

jest.mock("fs");
jest.mock("../lib/model.js", () => ({
    current: {
        enabled: true,
        tunnelEnabled: true,
        shortList: false,
        admin_song: null,
        debug: false,
    },
}));

const fs = require("fs");
const datamodel = require("../lib/model.js");
const stateCache = require("../lib/stateCache");

const VALID_CACHE = JSON.stringify({
    enabled: false,
    tunnelEnabled: false,
    shortList: true,
    admin_song: "Jingle_Bells",
    debug: true,
});

beforeEach(() => {
    jest.clearAllMocks();
    // Reset model to known defaults before each test
    datamodel.current.enabled = true;
    datamodel.current.tunnelEnabled = true;
    datamodel.current.shortList = false;
    datamodel.current.admin_song = null;
    datamodel.current.debug = false;
});

// ── load() ──────────────────────────────────────────────────────────────────

describe("load()", () => {
    test("restores all tracked fields from a valid cache file", () => {
        fs.readFileSync.mockReturnValue(VALID_CACHE);

        stateCache.load();

        expect(datamodel.current.enabled).toBe(false);
        expect(datamodel.current.tunnelEnabled).toBe(false);
        expect(datamodel.current.shortList).toBe(true);
        expect(datamodel.current.admin_song).toBe("Jingle_Bells");
        expect(datamodel.current.debug).toBe(true);
    });

    test("leaves model unchanged when cache file is missing (ENOENT)", () => {
        const err = new Error("ENOENT");
        err.code = "ENOENT";
        fs.readFileSync.mockImplementation(() => { throw err; });

        stateCache.load();

        // Model defaults should still be in place
        expect(datamodel.current.enabled).toBe(true);
        expect(datamodel.current.tunnelEnabled).toBe(true);
        expect(datamodel.current.admin_song).toBe(null);
    });

    test("leaves model unchanged on JSON parse error", () => {
        fs.readFileSync.mockReturnValue("not-valid-json{{{");

        stateCache.load();

        expect(datamodel.current.enabled).toBe(true);
    });

    test("silently skips fields absent from the cache file", () => {
        // Cache only contains 'enabled'; other fields should keep their defaults
        fs.readFileSync.mockReturnValue(JSON.stringify({ enabled: false }));

        stateCache.load();

        expect(datamodel.current.enabled).toBe(false);
        expect(datamodel.current.tunnelEnabled).toBe(true); // untouched default
        expect(datamodel.current.debug).toBe(false);       // untouched default
    });

    test("ignores unknown keys present in the cache file", () => {
        const withExtra = JSON.stringify({ enabled: false, unknownKey: "surprise" });
        fs.readFileSync.mockReturnValue(withExtra);

        stateCache.load();

        expect(datamodel.current.unknownKey).toBeUndefined();
    });
});

// ── save() ───────────────────────────────────────────────────────────────────

describe("save()", () => {
    test("writes a JSON snapshot of all tracked fields", () => {
        datamodel.current.enabled = false;
        datamodel.current.debug = true;

        stateCache.save();

        expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
        const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(written.enabled).toBe(false);
        expect(written.tunnelEnabled).toBe(true);
        expect(written.shortList).toBe(false);
        expect(written.admin_song).toBe(null);
        expect(written.debug).toBe(true);
    });

    test("uses a temp file then renames for atomic write", () => {
        stateCache.save();

        const writeCall = fs.writeFileSync.mock.calls[0];
        const renameCall = fs.renameSync.mock.calls[0];

        // Temp path ends with .tmp
        expect(writeCall[0]).toMatch(/\.tmp$/);
        // Rename moves temp → final
        expect(renameCall[0]).toBe(writeCall[0]);
        expect(renameCall[1]).not.toMatch(/\.tmp$/);
    });

    test("ensures the cache directory exists before writing", () => {
        stateCache.save();

        expect(fs.mkdirSync).toHaveBeenCalledWith(
            expect.any(String),
            { recursive: true }
        );
    });

    test("logs an error but does not throw when the write fails", () => {
        fs.mkdirSync.mockImplementation(() => { throw new Error("EACCES"); });
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});

        expect(() => stateCache.save()).not.toThrow();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

// ── startPeriodicSave() ──────────────────────────────────────────────────────

describe("startPeriodicSave()", () => {
    test("schedules save() to run every 60 seconds", () => {
        jest.useFakeTimers();

        stateCache.startPeriodicSave();

        // save() calls mkdirSync; count invocations as a proxy for save() calls
        const before = fs.mkdirSync.mock.calls.length;
        jest.advanceTimersByTime(60000);
        expect(fs.mkdirSync.mock.calls.length).toBeGreaterThan(before);

        jest.useRealTimers();
    });
});
