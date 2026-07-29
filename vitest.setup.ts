import "dotenv/config";
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// React Testing Library's own auto-cleanup relies on detecting a GLOBAL
// `afterEach` (e.g. Jest's implicit globals). This project's tests import
// `afterEach` explicitly from "vitest" instead of relying on injected
// globals, so that auto-detection never fires — without this, every
// `render()` call across a test file accumulates in the same jsdom
// `document.body`, and a later test's query can match a PREVIOUS test's
// leftover DOM (only surfaces once a test actually renders a component, so
// this stayed invisible until the first .test.tsx was written).
afterEach(cleanup);

// jsdom doesn't implement ResizeObserver — @puckeditor/core's drag-and-drop
// engine (@dnd-kit/dom) reads it at import time, so any test that mounts
// <Puck> throws "ResizeObserver is not defined" without this. A real
// callback never needs to fire in tests since jsdom doesn't perform actual
// layout anyway, so a no-op stub is the standard fix for this environment.
if (typeof globalThis.ResizeObserver === "undefined") {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
}

// jsdom also doesn't implement window.matchMedia — @puckeditor/core reads
// it (viewport/theme detection) during mount. Standard stub: always report
// "no match" for any query, since no test here depends on a specific query
// actually matching.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}
