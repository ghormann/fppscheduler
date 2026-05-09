"use strict";

jest.mock("axios");
const axios = require("axios");

jest.mock("../lib/model.js", () => ({
    all_playlists: [],
    all_playlists_internal: [],
    short_show_list: ["Hippo", "The_Grinch", "Fish_Joy"],
}));

const datamodel = require("../lib/model.js");
const { refreshPlayList, removeMatching } = require("../lib/playlist");

beforeEach(() => {
    jest.clearAllMocks();
    datamodel.all_playlists = [];
    datamodel.all_playlists_internal = [];
});

// ── removeMatching() ──────────────────────────────────────────────────────────

describe("removeMatching()", () => {
    test("removes elements matching the regex", () => {
        const arr = ["Apple", "TestApple", "Banana"];
        expect(removeMatching(arr, /Test/i)).toEqual(["Apple", "Banana"]);
    });

    test("is case-insensitive when the regex has the i flag", () => {
        const arr = ["internal_one", "PUBLIC", "INTERNAL_TWO"];
        expect(removeMatching(arr, /internal/i)).toEqual(["PUBLIC"]);
    });

    test("returns the array unchanged when nothing matches", () => {
        const arr = ["Song_A", "Song_B"];
        expect(removeMatching([...arr], /XYZ/)).toEqual(arr);
    });

    test("returns an empty array when all elements match", () => {
        expect(removeMatching(["Test1", "Test2"], /Test/)).toEqual([]);
    });

    test("handles an empty input array", () => {
        expect(removeMatching([], /Test/)).toEqual([]);
    });

    test("mutates the original array in-place", () => {
        const arr = ["TestSong", "RealSong"];
        removeMatching(arr, /Test/);
        expect(arr).toEqual(["RealSong"]);
    });
});

// ── refreshPlayList() ─────────────────────────────────────────────────────────

describe("refreshPlayList()", () => {
    test("stores only public (non-Test, non-Internal) playlists in all_playlists", async () => {
        axios.get
            .mockResolvedValueOnce({ data: ["TestSong", "Internal_Intro", "Hippo", "The_Grinch"] })
            .mockResolvedValueOnce({ data: { name: "Hippo",     entries: [] } })
            .mockResolvedValueOnce({ data: { name: "The_Grinch", entries: [] } });

        await refreshPlayList();

        expect(datamodel.all_playlists).toHaveLength(2);
        const names = datamodel.all_playlists.map(p => p.name);
        expect(names).toContain("Hippo");
        expect(names).toContain("The_Grinch");
    });

    test("marks shortlist entries correctly", async () => {
        axios.get
            .mockResolvedValueOnce({ data: ["Hippo", "NewSong"] })
            .mockResolvedValueOnce({ data: { name: "Hippo",   entries: [] } })
            .mockResolvedValueOnce({ data: { name: "NewSong", entries: [] } });

        await refreshPlayList();

        const hippo   = datamodel.all_playlists.find(p => p.name === "Hippo");
        const newSong = datamodel.all_playlists.find(p => p.name === "NewSong");
        expect(hippo.shortlist).toBe(true);
        expect(newSong.shortlist).toBe(false);
    });

    test("stores all playlist names (including internal) in all_playlists_internal", async () => {
        axios.get
            .mockResolvedValueOnce({ data: ["Internal_Intro", "Hippo"] })
            .mockResolvedValueOnce({ data: { name: "Hippo", entries: [] } });

        await refreshPlayList();

        expect(datamodel.all_playlists_internal).toContain("Internal_Intro");
        expect(datamodel.all_playlists_internal).toContain("Hippo");
    });

    test("returns an empty public list when all playlists are filtered out", async () => {
        axios.get.mockResolvedValueOnce({ data: ["TestOnly", "Internal_One"] });

        await refreshPlayList();

        expect(datamodel.all_playlists).toHaveLength(0);
    });

    test("sorts playlists alphabetically before filtering", async () => {
        axios.get
            .mockResolvedValueOnce({ data: ["Zebra", "Alpha", "Mango"] })
            .mockResolvedValueOnce({ data: { name: "Alpha", entries: [] } })
            .mockResolvedValueOnce({ data: { name: "Mango", entries: [] } })
            .mockResolvedValueOnce({ data: { name: "Zebra", entries: [] } });

        await refreshPlayList();

        const names = datamodel.all_playlists.map(p => p.name);
        expect(names).toEqual(["Alpha", "Mango", "Zebra"]);
    });
});
