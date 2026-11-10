const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { readPlaylist } = require("../desktop/playlist.cjs");

test("playlist keeps web and existing local audio entries", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "musiccube-"));
  try {
    fs.writeFileSync(path.join(dir, "song.mp3"), "");
    const playlist = path.join(dir, "songs.pls");
    fs.writeFileSync(playlist, "[playlist]\nFile1=song.mp3\nFile2=https://example.com/song.mp3\nFile3=missing.mp3\nTitle1=Song\n");
    assert.deepEqual(readPlaylist(playlist, (file) => `local:${file}`), [`local:${path.join(dir, "song.mp3")}`, "https://example.com/song.mp3"]);
  } finally {
    fs.unlinkSync(path.join(dir, "song.mp3"));
    fs.unlinkSync(path.join(dir, "songs.pls"));
    fs.rmdirSync(dir);
  }
});
