import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60000,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    environment: "node",
  },
});
