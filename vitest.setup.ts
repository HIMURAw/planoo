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
