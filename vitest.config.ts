import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60000,
    projects: [
      {
        test: {
          name: "node",
          include: ["tests/**/*.{test,spec}.{ts,tsx}"],
          environment: "node",
        },
      },
      {
        test: {
          name: "olympus",
          include: ["olympus/src/**/*.{test,spec}.{ts,tsx}"],
          environment: "jsdom",
        },
      },
    ],
  },
});
