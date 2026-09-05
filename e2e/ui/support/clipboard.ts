import type { BrowserContext } from "@playwright/test";

declare global {
  interface Window {
    __copiedText: string;
  }
}

export const stubClipboard = async (context: BrowserContext) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, "__copiedText", {
      value: "",
      writable: true,
      configurable: true,
    });

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async (text: string) => {
          window.__copiedText = text;
        },
      },
      configurable: true,
    });
  });
};
