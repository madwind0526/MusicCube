const fs = require("node:fs");
const path = require("node:path");

const AUDIO = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|webm)$/i;
const LIST = /\.(m3u|m3u8|pls)$/i;
const MAX_TRACKS = 5000;

function readPlaylist(file, fileUrl) {
  if (!LIST.test(file) || !fs.statSync(file).isFile()) return [];
  const urls = [];
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#") || /^(\[playlist\]|NumberOfEntries|Version)/i.test(line)) continue;
    line = line.replace(/^File\d+=/i, "");
    if (/^https?:\/\//i.test(line)) urls.push(line);
    else {
      const local = path.resolve(path.dirname(file), line);
      if (AUDIO.test(local) && fs.existsSync(local)) urls.push(fileUrl(local));
    }
    if (urls.length >= MAX_TRACKS) break;
  }
  return urls;
}

module.exports = { AUDIO, LIST, MAX_TRACKS, readPlaylist };
