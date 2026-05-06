import { describe, expect, it } from "vitest";

import {
  calculateScopeOverlapCount,
  hasNewScope,
  hasScopeIntersection,
  normalizeFileScope,
  normalizeScopeFile,
  normalizeScopeStem,
} from "../../../src/shared/file-scope.js";

describe("file-scope helpers", () => {
  it("normalizes Windows slashes and removes one leading dot slash before final trim", () => {
    expect(normalizeScopeFile("./src\\App.tsx")).toBe("src/App.tsx");
    expect(normalizeScopeFile("  ./src\\App.tsx  ")).toBe("./src/App.tsx");
  });

  it("keeps case unchanged by default", () => {
    expect(normalizeScopeFile("SRC/App.TSX")).toBe("SRC/App.TSX");
  });

  it("can lowercase for policy comparisons", () => {
    expect(normalizeScopeFile("./SRC/App.TSX", { lowercase: true })).toBe("src/app.tsx");
  });

  it("normalizes file scope by sorting and deduping non-empty entries", () => {
    expect(normalizeFileScope([
      " src/B.ts ",
      "",
      "./src/A.ts",
      "src/B.ts",
      "src\\C.ts",
    ])).toEqual({
      files: ["src/A.ts", "src/B.ts", "src/C.ts"],
    });
  });

  it("returns null for empty normalized file scopes", () => {
    expect(normalizeFileScope(["", "   "])).toBeNull();
  });

  it("normalizes stems by removing only the final extension after the last slash", () => {
    expect(normalizeScopeStem("src/domain.todo.ts")).toBe("src/domain.todo");
    expect(normalizeScopeStem("src/config/env")).toBe("src/config/env");
    expect(normalizeScopeStem("src/.env")).toBe("src/");
  });

  it("counts unique stem overlap", () => {
    expect(calculateScopeOverlapCount(
      ["src/App.tsx", "src/App.test.tsx", "src/domain/todo.ts"],
      ["src/App.jsx", "src/domain/todo.ts", "src/domain/todo.test.ts"],
    )).toBe(2);
  });

  it("checks normalized exact-scope intersection", () => {
    expect(hasScopeIntersection(["./src\\App.tsx"], ["src/App.tsx"])).toBe(true);
    expect(hasScopeIntersection(["SRC/App.tsx"], ["src/App.tsx"])).toBe(false);
  });

  it("checks whether expanded scope adds normalized files", () => {
    expect(hasNewScope(["src/App.tsx"], ["./src\\App.tsx"])).toBe(false);
    expect(hasNewScope(["src/App.tsx"], ["src/App.tsx", "src/main.tsx"])).toBe(true);
  });
});
