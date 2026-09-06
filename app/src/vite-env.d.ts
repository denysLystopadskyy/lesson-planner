/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Prefix applied to every storage key. Empty in production. */
  readonly VITE_STORAGE_PREFIX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
