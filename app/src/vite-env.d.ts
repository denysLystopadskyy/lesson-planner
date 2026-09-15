/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Prefix applied to every storage key. Empty in production. */
  readonly VITE_STORAGE_PREFIX?: string;
  /**
   * The address the app has moved to. Set only by the GitHub Pages build, so
   * the banner appears on the old site and never on the new one. Unset
   * everywhere else, including in development and in the test suite.
   */
  readonly VITE_MOVED_TO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
