import type { BrowserContext } from "@playwright/test";

declare global {
  interface Window {
    __copiedText: string;
  }
}

/**
 * How `navigator.clipboard` behaves for a test.
 *
 * - `"off"` leaves the real API in place.
 * - `"working"` records what was written so a test can read it back.
 * - `"failing"` rejects, which is what a browser does when the document is not
 *   focused or permission is refused. The app does not await the write, so this
 *   is how DEF-011 is exercised.
 */
export type ClipboardMode = "off" | "working" | "failing";

export const stubClipboard = async (
  context: BrowserContext,
  mode: Exclude<ClipboardMode, "off">,
) => {
  await context.addInitScript((stubMode: "working" | "failing") => {
    Object.defineProperty(window, "__copiedText", {
      value: "",
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: (text: string) => {
          if (stubMode === "failing") {
            return Promise.reject(new Error("clipboard write refused"));
          }
          window.__copiedText = text;
          return Promise.resolve();
        },
      },
      configurable: true,
    });
  }, mode);
};
