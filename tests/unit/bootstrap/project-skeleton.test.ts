import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

interface RootPackageJson {
  main: string;
  bin: Record<string, string>;
  scripts: Record<string, string>;
}

interface TsConfigShape {
  compilerOptions: {
    rootDir?: string;
    outDir?: string;
    noEmit?: boolean;
  };
  include?: string[];
}

interface WorkspaceContractFixture {
  requiredPaths: string[];
}

function readJson<T>(relativePath: string) {
  return JSON.parse(
    readFileSync(path.join(repoRoot, relativePath), "utf8"),
  ) as T;
}

describe("S00 project skeleton contract", () => {
  it("defines the shared TypeScript and Vitest toolchain", () => {
    expect(existsSync(path.join(repoRoot, "tsconfig.json"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "tsconfig.tests.json"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "vitest.config.ts"))).toBe(true);

    const packageJson = readJson<RootPackageJson>("package.json");
    const scripts = packageJson.scripts ?? {};
    const tsconfig = readJson<TsConfigShape>("tsconfig.json");
    const testTsconfig = readJson<TsConfigShape>("tsconfig.tests.json");

    expect(packageJson.main).toBe("dist/index.js");
    expect(packageJson.bin.aegis).toBe("dist/index.js");
    expect(scripts.build).toContain("tsc --project tsconfig.json");
    expect(scripts.dev).toBe("tsx src/index.ts");
    expect(scripts.test).toBe("vitest run --config vitest.config.ts");
    expect(scripts.lint).toContain("tsconfig.tests.json");
    expect(scripts.lint).toContain("lint --workspace olympus");
    expect(scripts["build:olympus"]).toBe("npm run build --workspace olympus");

    expect(tsconfig.compilerOptions.rootDir).toBe("src");
    expect(tsconfig.compilerOptions.outDir).toBe("dist");
    expect(tsconfig.include).toEqual(["src/**/*.ts"]);
    expect(testTsconfig.compilerOptions.noEmit).toBe(true);
    expect((testTsconfig.include as string[])).toEqual(
      expect.arrayContaining(["src/**/*.ts", "tests/**/*.ts", "vitest.config.ts"]),
    );
  });

  it("scaffolds the node entrypoint and shared path helpers", async () => {
    const sharedPathsModule = (await import(
      pathToFileURL(path.join(repoRoot, "src/shared/paths.ts")).href
    )) as {
      resolveProjectPaths: (root?: string) => {
        repoRoot: string;
        srcRoot: string;
        distRoot: string;
      };
    };
    const entrypointModule = (await import(
      pathToFileURL(path.join(repoRoot, "src/index.ts")).href
    )) as {
      buildBootstrapManifest: (root?: string) => {
        appName: string;
        paths: {
          repoRoot: string;
          srcRoot: string;
          distRoot: string;
        };
      };
    };

    const paths = sharedPathsModule.resolveProjectPaths(repoRoot);

    expect(paths).toEqual({
      repoRoot,
      srcRoot: path.join(repoRoot, "src"),
      distRoot: path.join(repoRoot, "dist"),
    });

    expect(entrypointModule.buildBootstrapManifest(repoRoot)).toEqual({
      appName: "aegis",
      paths,
    });
  });

  it("defines a minimal Olympus Vite build shell", async () => {
    const olympusPackageJson = readJson<RootPackageJson>("olympus/package.json");
    const scripts = olympusPackageJson.scripts ?? {};
    const vitestConfig = (await import(
      pathToFileURL(path.join(repoRoot, "vitest.config.ts")).href
    )) as {
      default: {
        test?: {
          include?: string[];
        };
      };
    };

    expect(existsSync(path.join(repoRoot, "olympus/tsconfig.json"))).toBe(true);
    expect(scripts.lint).toContain("tsc --project tsconfig.json --noEmit");
    expect(scripts.build).toContain("npm run lint");
    expect(scripts.build).toContain("vite build");
    expect(vitestConfig.default.test?.include).toEqual(
      expect.arrayContaining([
        "tests/**/*.{test,spec}.{ts,tsx}",
        "olympus/src/**/*.{test,spec}.{ts,tsx}",
      ]),
    );
  });

  it("creates the workspace skeleton needed by the implementation lanes", () => {
    const fixture = readJson<WorkspaceContractFixture>(
      "tests/fixtures/bootstrap/workspace-contract.json",
    );
    const expectedPaths = fixture.requiredPaths;

    expect(Array.isArray(expectedPaths)).toBe(true);
    expect(expectedPaths.length).toBeGreaterThan(0);

    for (const expectedPath of expectedPaths) {
      expect(existsSync(path.join(repoRoot, expectedPath)), expectedPath).toBe(
        true,
      );
    }
  });
});
