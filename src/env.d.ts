// The bridge exposed by desktop/preload.cjs (absent when the page is opened in a plain browser).
declare global {
  interface Window {
    api?: {
      settingsLoad(): string | null;
      settingsSave(data: string): boolean;
      fsList(p: string): Promise<{ path: string; parent: string; dirs: { name: string; path: string }[]; files: { name: string; path: string; kind: "audio" | "list" }[] } | null>;
      scan(dir: string): Promise<string[]>;
      readPlaylist(file: string): Promise<string[]>;
      moveBy(dx: number, dy: number): void;
      setOnTop(v: boolean): void;
      ignoreMouse(v: boolean): void;
      setSize(w: number, h: number, cubeY: number): void;
      openPanel(kind: "settings" | "folder", anchorY: number): void;
      closePanel(): void;
      fitPanel(h: number): void;
      quit(): void;
      eqSet(gains: number[], on: boolean): void;
      eqState(available: boolean): void;
      eqAvailable(): boolean;
      onEqSet(fn: (gains: number[], on: boolean) => void): void;
      onEqState(fn: (available: boolean) => void): void;
    };
  }
}

export {};
