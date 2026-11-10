// Local audio feeds the analyser; remote audio plays directly, and YouTube uses an IFrame player.
// Sources outside Web Audio use a synthetic spectrum when loopback capture is unavailable.

/** Played when no folder is chosen: same YouTube playlist as Paradise. */
export const DEFAULT_TRACK = "https://www.youtube.com/watch?v=1t39vq3LdRs&list=PLCqwmfitbQCY";

// Same bands, filter shape and scale as the Paradise equalizer.
export const EQ_BANDS = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
export const EQ_LABELS = ["31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
export const EQ_PRESETS: Record<string, number[]> = {
  "Flat": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Boost": [46, 33, 21, 8, 0, -4, -8, -8, -4, 0],
  "Vocal Boost": [-17, -13, -4, 4, 13, 21, 25, 17, 4, -4],
  "Treble Boost": [-8, -4, 0, 0, 4, 8, 21, 38, 50, 58],
  "Loudness": [33, 21, 8, 0, -8, -13, -4, 8, 21, 29],
  "Acoustic": [13, 17, 13, 4, 0, 4, 8, 13, 8, 4],
};

export interface Player {
  /** The analyser to read: the file's, or (YouTube) the one fed by the system's audio output. */
  readonly analyser: AnalyserNode;
  /** True when the current source cannot feed the analyser and the spectrum is faked. */
  readonly synthetic: boolean;
  /** True when the current source can go through the Web Audio equalizer. */
  readonly eqAvailable: boolean;
  readonly playing: boolean;
  /** Empty list = the default YouTube playlist. */
  setList(urls: string[], defaultWhenEmpty?: boolean): void;
  toggle(): void;
  next(): void;
  /** gains: 10 values in -100..100, where +-100 is +-24 dB. */
  setEq(gains: number[], on: boolean): void;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
}

function parseYouTube(u: string): { list?: string; video?: string } {
  const url = new URL(u);
  return { list: url.searchParams.get("list") ?? undefined, video: url.searchParams.get("v") ?? (url.hostname === "youtu.be" ? url.pathname.slice(1) : undefined) };
}

const isYouTube = (u: string) => {
  try { return /^(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)$/i.test(new URL(u).hostname); } catch { return false; }
};

let ytApi: Promise<any> | null = null;
function loadYtApi(): Promise<any> {
  return (ytApi ??= new Promise((resolve, reject) => {
    const w = window as any;
    if (w.YT?.Player) return resolve(w.YT);
    w.onYouTubeIframeAPIReady = () => resolve(w.YT);
    const sc = document.createElement("script");
    sc.src = "https://www.youtube.com/iframe_api";
    sc.onerror = () => { ytApi = null; reject(new Error("youtube api")); };
    document.head.append(sc);
  }));
}

export function createPlayer(onState: () => void): Player {
  const el = new Audio();
  const remote = new Audio();
  if (import.meta.env.DEV) (window as any).__el = el; // test hook, dev mode only
  el.crossOrigin = "anonymous"; // mcfile:// answers with CORS headers, so the analyser can read it
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  const eqFilters: BiquadFilterNode[] = [];
  let node: AudioNode = ctx.createMediaElementSource(el);
  for (const frequency of EQ_BANDS) {
    const filter = ctx.createBiquadFilter();
    filter.type = "peaking";
    filter.frequency.value = frequency;
    filter.Q.value = 1.4;
    node.connect(filter);
    node = filter;
    eqFilters.push(filter);
  }
  node.connect(analyser);
  analyser.connect(ctx.destination);

  let list: string[] = [];
  let idx = -1;
  let useYt = true;
  let ytUrl = DEFAULT_TRACK;
  let errors = 0;

  // ---- YouTube backend ----
  // The IFrame player's sound cannot be tapped, so capture the system's audio output (Electron loopback) and analyse that.
  let loopAnalyser: AnalyserNode | null = null;
  let loopTried = false;
  async function startLoopback() {
    if (loopTried) return;
    loopTried = true;
    try {
      const st = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      st.getVideoTracks().forEach((t) => t.stop()); // only the sound is wanted
      if (!st.getAudioTracks().length) return;
      const an = ctx.createAnalyser();
      an.fftSize = 256;
      an.smoothingTimeConstant = 0.8;
      ctx.createMediaStreamSource(new MediaStream(st.getAudioTracks())).connect(an); // not to the speakers: it would echo
      loopAnalyser = an;
    } catch (e) {
      console.warn("loopback capture failed", e); // keeps the fake spectrum
    }
  }

  let yt: any = null, ytReady = false, ytPlaying = false, wantPlay = false, ytIdx = 0;
  let ytHost: HTMLElement | null = null;
  let ytStarting = false, ytGeneration = 0;

  async function startYt() {
    if (ytStarting) return;
    ytStarting = true;
    const generation = ytGeneration;
    try {
      const YT = await loadYtApi();
      if (generation !== ytGeneration) return;
      const { list: pl, video } = parseYouTube(ytUrl);
      ytHost = document.createElement("div");
      ytHost.style.cssText = "position:fixed;left:-400px;bottom:0;width:200px;height:200px;pointer-events:none"; // audio only
      const inner = document.createElement("div");
      ytHost.append(inner);
      document.body.append(ytHost);
      const host = ytHost;
      yt = new YT.Player(inner, {
        width: 200, height: 200,
        ...(video ? { videoId: video } : {}),
        playerVars: { playsinline: 1, ...(pl ? { listType: "playlist", list: pl } : { loop: 1, playlist: video }) },
        events: {
          onReady: (e: any) => {
            if (ytHost !== host) return;
            ytReady = true;
            e.target.setLoop?.(p.repeat === "all");
            e.target.setShuffle?.(p.shuffle);
            if (!wantPlay) return;
            const n: number = e.target.getPlaylist?.()?.length ?? 0;
            if (p.shuffle && n > 1) e.target.playVideoAt(Math.floor(Math.random() * n)); // do not always start at track 1
            else e.target.playVideo();
          },
          onError: () => {
            yt?.nextVideo?.();
          }, // unplayable (embedding disabled) videos are skipped
          onStateChange: (e: any) => {
            ytPlaying = e.data === 1;
            if (e.data === 1) ytIdx = e.target.getPlaylistIndex?.() ?? 0;
            else if (e.data === 0 && p.repeat === "one") e.target.playVideoAt?.(ytIdx);
            onState();
          },
        },
      });
    } catch (e) {
      console.warn("YouTube player failed", e); // offline or blocked: stays silent
    } finally {
      if (generation === ytGeneration) ytStarting = false;
    }
  }

  function destroyYt() {
    ytGeneration++;
    ytStarting = false;
    try { yt?.destroy(); } catch { /* already gone */ }
    ytHost?.remove();
    yt = ytHost = null;
    ytReady = ytPlaying = wantPlay = false;
  }

  // ---- local and remote audio backends ----
  const active = () => list[idx]?.startsWith("mcfile:") ? el : remote;
  const load = (i: number) => {
    el.pause(); remote.pause();
    idx = i;
    const current = active();
    current.src = list[i];
    if (current === el) void ctx.resume();
    current.play().catch(onState);
  };

  let shuffle = false;
  let repeat: Player["repeat"] = "all";
  let eqGains = EQ_BANDS.map(() => 0);
  let eqOn = true;

  const p: Player = {
    get analyser() { return useYt && loopAnalyser ? loopAnalyser : analyser; },
    get synthetic() { return useYt ? !loopAnalyser : idx >= 0 && active() === remote; },
    get eqAvailable() { return !useYt && idx >= 0 && active() === el; },
    get playing() { return useYt ? ytPlaying : !active().paused; },
    get shuffle() { return shuffle; },
    set shuffle(v) { shuffle = v; if (ytReady) yt.setShuffle?.(v); },
    get repeat() { return repeat; },
    set repeat(v) { repeat = v; if (ytReady) yt.setLoop?.(v === "all"); },
    setList(urls, defaultWhenEmpty = true) {
      el.pause();
      el.removeAttribute("src");
      remote.pause();
      remote.removeAttribute("src");
      destroyYt();
      const youtube = urls.find(isYouTube);
      ytUrl = youtube ?? DEFAULT_TRACK;
      list = youtube ? [] : urls;
      idx = -1;
      errors = 0;
      useYt = !!youtube || (urls.length === 0 && defaultWhenEmpty);
      onState();
    },
    toggle() {
      if (useYt) {
        void startLoopback();
        if (!yt) { wantPlay = true; void startYt(); }
        else if (!ytReady) wantPlay = true;
        else if (ytPlaying) yt.pauseVideo(); else yt.playVideo();
        return;
      }
      if (!list.length) return;
      if (idx < 0) load(0);
      else if (active().paused) { if (active() === el) void ctx.resume(); active().play().catch(onState); } else active().pause();
    },
    next() {
      if (useYt) { if (ytReady) yt.nextVideo(); return; }
      if (list.length) load(shuffle ? Math.floor(Math.random() * list.length) : (idx + 1) % list.length);
    },
    setEq(gains, on) {
      eqGains = EQ_BANDS.map((_, i) => {
        const n = Number(gains[i]);
        return Number.isFinite(n) ? Math.max(-100, Math.min(100, n)) : 0;
      });
      eqOn = on;
      eqFilters.forEach((filter, i) => { filter.gain.value = on ? (eqGains[i] / 100) * 24 : 0; });
    },
  };

  for (const media of [el, remote]) {
    media.addEventListener("play", () => { errors = 0; onState(); });
    media.addEventListener("pause", onState);
    media.addEventListener("error", () => {
      if (media !== active() || !media.getAttribute("src")) return;
      if (++errors < list.length) p.next();
      else { media.removeAttribute("src"); onState(); }
    });
    media.addEventListener("ended", () => {
      if (media !== active()) return;
      if (repeat === "one") load(idx);
      else if (repeat === "all" || shuffle || idx < list.length - 1) p.next();
      else onState();
    });
  }
  return p;
}
