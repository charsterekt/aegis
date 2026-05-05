import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 60000,
    environment: "node",
    projects: [
      {
        test: {
          name: "default",
          testTimeout: 60000,
          include: ["tests/**/*.{test,spec}.{ts,tsx}", "packages/*/tests/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["tests/acceptance/**/*.{test,spec}.{ts,tsx}"],
          environment: "node",
        },
      },
      {
        test: {
          name: "acceptance",
          testTimeout: 60000,
          include: ["tests/acceptance/**/*.{test,spec}.{ts,tsx}"],
          environment: "node",
        },
      },
    ],
  },
});
