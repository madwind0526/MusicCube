const assert = require("node:assert/strict");
const fs = require("node:fs");
const { stripTypeScriptTypes } = require("node:module");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/audio.ts"), "utf8").replaceAll("import.meta.env.DEV", "false");
const code = stripTypeScriptTypes(source).replace(/^export /gm, "") + "\nexports.createPlayer = createPlayer;";

function setup(getDisplayMedia = async () => { throw new Error("capture disabled"); }) {
  const players = [];
  const filters = [];
  const win = {};
  class Audio {
    paused = true;
    pause() { this.paused = true; }
    play() { this.paused = false; return Promise.resolve(); }
    removeAttribute() {}
    addEventListener() {}
  }
  class AudioContext {
    destination = {};
    createAnalyser() { return { connect() {} }; }
    createMediaElementSource() { return { connect() {} }; }
    createMediaStreamSource() { return { connect() {} }; }
    createBiquadFilter() {
      const filter = { type: "", frequency: { value: 0 }, Q: { value: 0 }, gain: { value: 0 }, connect() {} };
      filters.push(filter);
      return filter;
    }
    resume() { return Promise.resolve(); }
  }
  const element = () => ({ style: {}, append() {}, remove() {} });
  const exports = {};
  vm.runInNewContext(code, {
    exports, Audio, AudioContext, URL, MediaStream: class { constructor(tracks) { this.tracks = tracks; } getTracks() { return this.tracks; } },
    window: win,
    navigator: { mediaDevices: { getDisplayMedia } },
    document: { createElement: element, head: { append() {} }, body: { append() {} } },
    console: { warn() {} },
  });
  const resolveApi = () => {
    win.YT = { Player: class {
      constructor(_host, options) { players.push(this); this.options = options; }
      destroy() {}
    } };
    win.onYouTubeIframeAPIReady();
  };
  return { player: exports.createPlayer(() => {}), players, filters, resolveApi };
}

test("rapid play requests create one YouTube player", async () => {
  const { player, players, resolveApi } = setup();
  player.toggle();
  player.toggle();
  resolveApi();
  await new Promise(setImmediate);
  assert.equal(players.length, 1);
});

test("source change while YouTube API loads discards the old player", async () => {
  const { player, players, resolveApi } = setup();
  player.toggle();
  player.setList(["https://www.youtube.com/watch?v=3B10BV4VlCM"]);
  player.toggle();
  resolveApi();
  await new Promise(setImmediate);
  assert.equal(players.length, 1);
  assert.equal(players[0].options.videoId, "3B10BV4VlCM");
});

test("empty selected folder does not start the default YouTube playlist", async () => {
  const { player, players } = setup();
  player.setList([], false);
  player.toggle();
  await new Promise(setImmediate);
  assert.equal(players.length, 0);
});

test("equalizer maps -100..100 to -24..24 dB and can be bypassed", () => {
  const { player, filters } = setup();
  assert.equal(filters.length, 10);
  player.setEq([100, -100, 50, 0, 0, 0, 0, 0, 0, 0], true);
  assert.equal(filters[0].gain.value, 24);
  assert.equal(filters[1].gain.value, -24);
  assert.equal(filters[2].gain.value, 12);
  player.setEq([100, -100, 50, 0, 0, 0, 0, 0, 0, 0], false);
  assert.ok(filters.every((filter) => filter.gain.value === 0));
});

test("a list that mixes files and YouTube links plays the files", async () => {
  const { player, players } = setup();
  player.setList(["mcfile://local/a.mp3", "https://www.youtube.com/watch?v=3B10BV4VlCM", "https://example.com/b.mp3"]);
  player.toggle();
  await new Promise(setImmediate);
  assert.equal(players.length, 0, "no YouTube player for a mixed list");
  assert.equal(player.playing, true);
  assert.equal(player.eqAvailable, true, "the local file is the one playing");
});

test("a failed system-audio capture is retried, and the capture is released when YouTube is left", async () => {
  let calls = 0, stopped = false;
  const track = { stop() { stopped = true; }, addEventListener() {} };
  const stream = { getVideoTracks: () => [], getAudioTracks: () => [track], getTracks: () => [track] };
  const { player } = setup(async () => { if (++calls === 1) throw new Error("device busy"); return stream; });
  player.toggle();                    // first attempt fails
  await new Promise(setImmediate);
  assert.equal(player.synthetic, true, "fake spectrum while the capture is missing");
  player.toggle();                    // the next play tries again
  await new Promise(setImmediate);
  assert.equal(calls, 2);
  assert.equal(player.synthetic, false, "real spectrum once the capture works");
  player.setList(["mcfile://local/a.mp3"]); // a local file does not need the system audio
  assert.equal(stopped, true, "the capture tracks are stopped");
});
