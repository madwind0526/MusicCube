// MusicCube desktop shell: one small transparent frameless always-on-top window, no server.
const { app, BrowserWindow, desktopCapturer, ipcMain, net, protocol, screen, session } = require("electron");
const fs = require("node:fs");
const crypto = require("node:crypto");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEV = process.argv.includes("--dev");
const settingsFile = path.join(app.getPath("userData"), "settings.json");
const fileToken = crypto.randomBytes(16).toString("hex");
const allowedAudio = new Set();
const { AUDIO, LIST, MAX_TRACKS, readPlaylist } = require("./playlist.cjs");
const natural = (a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

// Local audio is served through mcfile:// so the page stays web-secure and the analyser gets CORS-clean media.
protocol.registerSchemesAsPrivileged([
  { scheme: "mcfile", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } },
]);

if (!app.requestSingleInstanceLock()) { app.quit(); return; }

let win;
function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    width: 560, height: 560, x: wa.x + wa.width - 600, y: wa.y + 20,
    title: "MusicCube", frame: false, transparent: true, hasShadow: false, resizable: false,
    skipTaskbar: true, alwaysOnTop: true, backgroundColor: "#00000000",
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), autoplayPolicy: "no-user-gesture-required" },
  });
  if (DEV) win.loadURL("http://127.0.0.1:5188/");
  else win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

const fileUrl = (p) => { allowedAudio.add(p); return "mcfile://local/" + encodeURIComponent(p) + "?token=" + fileToken; };

function roots() {
  const out = [];
  for (let c = 65; c <= 90; c++) { const d = String.fromCharCode(c) + ":" + String.fromCharCode(92); if (fs.existsSync(d)) out.push({ name: d, path: d }); }
  return out;
}

// One folder level for the explorer: sub-folders and audio files (shown for context only).
function listDir(p) {
  if (p === "@roots") return { path: "@roots", parent: "", dirs: roots(), files: [] };
  if (!p) { const music = path.join(os.homedir(), "Music"); p = fs.existsSync(music) ? music : os.homedir(); }
  p = path.resolve(p);
  const ents = fs.readdirSync(p, { withFileTypes: true });
  const dirs = ents.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name).sort(natural).map((name) => ({ name, path: path.join(p, name) }));
  const files = ents.filter((e) => e.isFile() && (AUDIO.test(e.name) || LIST.test(e.name))).map((e) => e.name).sort(natural).map((name) => ({ name, path: path.join(p, name), kind: LIST.test(name) ? "list" : "audio" }));
  const up = path.dirname(p);
  return { path: p, parent: up === p ? "@roots" : up, dirs, files };
}

// Every audio file below a folder.
function walk(root) {
  const out = [];
  const stack = [path.resolve(root)];
  while (stack.length && out.length < MAX_TRACKS) {
    const d = stack.pop();
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; } // unreadable folder: skip
    for (const e of ents) {
      const full = path.join(d, e.name);
      if (e.isDirectory() && !e.name.startsWith(".")) stack.push(full);
      else if (e.isFile() && AUDIO.test(e.name)) { out.push(full); if (out.length >= MAX_TRACKS) break; }
    }
  }
  return out.sort(natural).slice(0, MAX_TRACKS).map(fileUrl);
}

ipcMain.handle("fs-list", (_e, p) => { try { return listDir(p); } catch { return null; } });
ipcMain.handle("scan", (_e, dir) => { try { return walk(dir); } catch { return []; } });
ipcMain.handle("read-playlist", (_e, file) => { try { return readPlaylist(file, fileUrl); } catch { return []; } });
ipcMain.on("settings-load", (e) => {
  try { e.returnValue = fs.readFileSync(settingsFile, "utf8"); } catch { e.returnValue = null; }
});
ipcMain.on("settings-save", (e, data) => {
  e.returnValue = false;
  if (typeof data !== "string" || data.length > 2_000_000) return;
  try {
    JSON.parse(data);
    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
    fs.writeFileSync(settingsFile + ".tmp", data);
    fs.renameSync(settingsFile + ".tmp", settingsFile);
    e.returnValue = true;
  } catch (error) { console.warn("Settings save failed", error); }
});
// Moves the window the message came from (the cube window or the settings/folder window).
ipcMain.on("move-by", (e, dx, dy) => { const w = BrowserWindow.fromWebContents(e.sender); if (!w) return; const [x, y] = w.getPosition(); w.setPosition(Math.round(x + dx), Math.round(y + dy)); });

// Settings / folder window: its own frameless window under the cube, so it can be moved on its own.
let panel = null, panelKind = "";
let onTop = true;
let eqAvailable = false;
ipcMain.on("open-panel", (_e, kind, anchorY) => {
  if (kind !== "settings" && kind !== "folder") return;
  if (panel && !panel.isDestroyed()) { const same = panelKind === kind; panel.close(); if (same) return; } // same button again = close
  const mb = win.getBounds();
  const wa = screen.getDisplayMatching(mb).workArea;
  const W = 340, H = 440;
  const x = Math.min(Math.max(Math.round(mb.x + mb.width / 2 - W / 2), wa.x), wa.x + wa.width - W);
  const y = Math.min(Math.max(Math.round(mb.y + anchorY), wa.y), wa.y + wa.height - H);
  panelKind = kind;
  const created = new BrowserWindow({
    width: W, height: H, x, y, title: "MusicCube Panel", frame: false, transparent: true, hasShadow: false, resizable: false,
    skipTaskbar: true, alwaysOnTop: onTop, backgroundColor: "#00000000",
    webPreferences: { preload: path.join(__dirname, "preload.cjs") },
  });
  panel = created;
  created.on("closed", () => { if (panel === created) { panel = null; panelKind = ""; } });
  if (DEV) created.loadURL(`http://127.0.0.1:5188/panel.html?kind=${kind}`);
  else created.loadFile(path.join(__dirname, "..", "dist", "panel.html"), { query: { kind } });
});
ipcMain.on("close-panel", (e) => BrowserWindow.fromWebContents(e.sender)?.close());
ipcMain.on("fit-panel", (e, h) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  if (!w) return;
  const b = w.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  h = Math.min(Math.round(h), wa.height);
  w.setBounds({ x: b.x, y: Math.max(wa.y, Math.min(b.y, wa.y + wa.height - h)), width: b.width, height: h });
});
ipcMain.on("on-top", (_e, v) => { onTop = !!v; win.setAlwaysOnTop(onTop); panel?.setAlwaysOnTop(onTop); });
ipcMain.on("ignore", (_e, v) => win.setIgnoreMouseEvents(!!v, { forward: true }));
// Resize keeping the cube where it is: it sits at the horizontal centre, `cubeY` px below the window top.
let cubeY = 280;
ipcMain.on("set-size", (_e, w, h, newCubeY) => {
  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  w = Math.round(w); h = Math.round(h); newCubeY = Math.round(newCubeY);
  const cx = b.x + b.width / 2, cy = b.y + cubeY;
  cubeY = newCubeY;
  const x = Math.min(Math.max(Math.round(cx - w / 2), wa.x), wa.x + wa.width - w);
  const y = Math.min(Math.max(Math.round(cy - newCubeY), wa.y), wa.y + wa.height - h);
  win.setBounds({ x, y, width: w, height: h });
});
ipcMain.on("quit", () => app.quit());
ipcMain.on("eq-set", (e, gains, on) => {
  const p = panel && !panel.isDestroyed() ? panel : null;
  if (p && e.sender !== p.webContents) p.webContents.send("eq-set", gains, on);
  if (win && !win.isDestroyed() && e.sender !== win.webContents) win.webContents.send("eq-set", gains, on);
});
ipcMain.on("eq-state", (e, available) => {
  eqAvailable = !!available;
  const p = panel && !panel.isDestroyed() ? panel : null;
  if (p && e.sender !== p.webContents) p.webContents.send("eq-state", eqAvailable);
});
ipcMain.on("eq-query", (e) => { e.returnValue = eqAvailable; });

app.whenReady().then(() => {
  // getDisplayMedia answers with the system's audio output (loopback), so the visualizer can analyse YouTube too.
  session.defaultSession.setDisplayMediaRequestHandler(async (req, cb) => {
    if (req.frame !== win?.webContents.mainFrame) return cb({});
    try {
      const sources = await desktopCapturer.getSources({ types: ["screen"] });
      cb(sources[0] ? { video: sources[0], audio: "loopback" } : {});
    } catch { cb({}); }
  });
  // YouTube embeds refuse a page without an http(s) referrer (file:// pages get "error 153"), so give them one.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["*://*.youtube.com/*", "*://*.youtube-nocookie.com/*"] }, (d, cb) => {
    d.requestHeaders["Referer"] = "http://127.0.0.1:5188/";
    cb({ requestHeaders: d.requestHeaders });
  });
  protocol.handle("mcfile", async (req) => {
    try {
      const url = new URL(req.url);
      if (url.searchParams.get("token") !== fileToken) return new Response("", { status: 403 });
      const p = decodeURIComponent(url.pathname.slice(1));
      if (!AUDIO.test(p) || !allowedAudio.has(p)) return new Response("", { status: 403 });
      const r = await net.fetch(pathToFileURL(p).href, { headers: req.headers });
      return new Response(r.body, { status: r.status, headers: { ...Object.fromEntries(r.headers), "access-control-allow-origin": "*" } });
    } catch { return new Response("", { status: 404 }); }
  });
  createWindow();
});
app.on("second-instance", () => win && win.focus());
app.on("window-all-closed", () => app.quit());
