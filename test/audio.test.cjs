const assert = require("node:assert/strict");
const fs = require("node:fs");
const { stripTypeScriptTypes } = require("node:module");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../src/audio.ts"), "utf8").replaceAll("import.meta.env.DEV", "false");
const code = stripTypeScriptTypes(source).replace(/^export /gm, "") + "\nexports.createPlayer = createPlayer;";

function setup() {
  const players = [];
  const win = {};
  class Audio {
    paused = true;
    pause() { this.paused = true; }
    removeAttribute() {}
    addEventListener() {}
  }
  class AudioContext {
    destination = {};
    createAnalyser() { return { connect() {} }; }
    createMediaElementSource() { return { connect() {} }; }
    resume() { return Promise.resolve(); }
  }
  const element = () => ({ style: {}, append() {}, remove() {} });
  const exports = {};
  vm.runInNewContext(code, {
    exports, Audio, AudioContext, URL,
    window: win,
    navigator: { mediaDevices: { getDisplayMedia: async () => { throw new Error("capture disabled"); } } },
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
  return { player: exports.createPlayer(() => {}), players, resolveApi };
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
