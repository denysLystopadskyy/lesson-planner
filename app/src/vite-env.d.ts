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
  /**
   * Where Neon Auth answers, from `neon neon-auth status`. Public by nature —
   * the browser has to send the user there — so a `VITE_` name is correct here
   * rather than a leak. Unset in development and in the suite, and the app
   * then offers no account control at all (batch 5.3b).
   */
  readonly VITE_NEON_AUTH_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
