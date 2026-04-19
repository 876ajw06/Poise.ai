/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GEMINI_API_KEY?: string;
  /** Live API model id, e.g. `gemini-3.1-flash-live-preview` (default in code) or `gemini-live-2.5-flash-preview`. */
  readonly VITE_GEMINI_LIVE_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
