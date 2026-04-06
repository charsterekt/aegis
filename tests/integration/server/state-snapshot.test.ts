import path from "node:path";
import { pathToFileURL } from "node:url";

import { describe, it, expect } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");

describe("S07 state snapshot returns correct mode", () => {
  it("returns conversational mode as default", async () => {
    const routesModule = (await import(
      pathToFileURL(path.join(repoRoot, "src", "server", "routes.ts")).href
    )) as {
      HTTP_ROUTE_PATHS: Record<string, string>;
      createRestApiRouter: (bindings: {
        getStateSnapshot: () => Record<string, unknown>;
        executeControlAction: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
        appendLearningRecord: (entry: Record<string, unknown>) => Promise<Record<string, unknown>>;
        ingestBeadsHookEvent: (payload: unknown) => Promise<void>;
      }) => {
        handleRequest: (request: {
          method: string;
          path: string;
          body?: unknown;
          headers?: Record<string, string | undefined>;
          remoteAddress?: string;
        }) => Promise<{
          status: number;
          headers: Record<string, string>;
          body?: unknown;
        } | null>;
      };
    };

    const router = routesModule.createRestApiRouter({
      getStateSnapshot: () => ({
        orchestrator: { server_state: "running", mode: "conversational", uptime_ms: 1000 },
        agents: { active: 0 },
        queue: { depth: 0 },
        issues: { ready: [], active: [] },
      }),
      executeControlAction: async (request) => ({
        ok: true,
        action: request.action as string,
        request_id: request.request_id as string,
        acknowledged_at: new Date().toISOString(),
        server_state: "running",
        mode: "conversational",
        message: "accepted",
      }),
      appendLearningRecord: async () => ({ ok: true }),
      ingestBeadsHookEvent: async () => {},
    });

    const response = await router.handleRequest({
      method: "GET",
      path: routesModule.HTTP_ROUTE_PATHS.state,
    });

    expect(response?.status).toBe(200);
    const body = response?.body as Record<string, unknown>;
    const orchestrator = body.orchestrator as Record<string, unknown>;
    expect(orchestrator.mode).toBe("conversational");
  });

  it("returns auto mode when enabled", async () => {
    const routesModule = (await import(
      pathToFileURL(path.join(repoRoot, "src", "server", "routes.ts")).href
    )) as {
      HTTP_ROUTE_PATHS: Record<string, string>;
      createRestApiRouter: (bindings: {
        getStateSnapshot: () => Record<string, unknown>;
        executeControlAction: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
        appendLearningRecord: (entry: Record<string, unknown>) => Promise<Record<string, unknown>>;
        ingestBeadsHookEvent: (payload: unknown) => Promise<void>;
      }) => {
        handleRequest: (request: {
          method: string;
          path: string;
          body?: unknown;
          headers?: Record<string, string | undefined>;
          remoteAddress?: string;
        }) => Promise<{
          status: number;
          headers: Record<string, string>;
          body?: unknown;
        } | null>;
      };
    };

    const router = routesModule.createRestApiRouter({
      getStateSnapshot: () => ({
        orchestrator: { server_state: "running", mode: "auto", uptime_ms: 2000 },
        agents: { active: 1 },
        queue: { depth: 3 },
        issues: { ready: ["aegis-fjm.8.3"], active: ["aegis-fjm.8.2"] },
      }),
      executeControlAction: async (request) => ({
        ok: true,
        action: request.action as string,
        request_id: request.request_id as string,
        acknowledged_at: new Date().toISOString(),
        server_state: "running",
        mode: "auto",
        message: "accepted",
      }),
      appendLearningRecord: async () => ({ ok: true }),
      ingestBeadsHookEvent: async () => {},
    });

    const response = await router.handleRequest({
      method: "GET",
      path: routesModule.HTTP_ROUTE_PATHS.state,
    });

    expect(response?.status).toBe(200);
    const body = response?.body as Record<string, unknown>;
    const orchestrator = body.orchestrator as Record<string, unknown>;
    expect(orchestrator.mode).toBe("auto");
  });

  it("includes paused flag in state snapshot", async () => {
    const routesModule = (await import(
      pathToFileURL(path.join(repoRoot, "src", "server", "routes.ts")).href
    )) as {
      HTTP_ROUTE_PATHS: Record<string, string>;
      createRestApiRouter: (bindings: {
        getStateSnapshot: () => Record<string, unknown>;
        executeControlAction: (request: Record<string, unknown>) => Promise<Record<string, unknown>>;
        appendLearningRecord: (entry: Record<string, unknown>) => Promise<Record<string, unknown>>;
        ingestBeadsHookEvent: (payload: unknown) => Promise<void>;
      }) => {
        handleRequest: (request: {
          method: string;
          path: string;
          body?: unknown;
          headers?: Record<string, string | undefined>;
          remoteAddress?: string;
        }) => Promise<{
          status: number;
          headers: Record<string, string>;
          body?: unknown;
        } | null>;
      };
    };

    const router = routesModule.createRestApiRouter({
      getStateSnapshot: () => ({
        orchestrator: { server_state: "running", mode: "auto", paused: true, uptime_ms: 3000 },
        agents: { active: 0 },
        queue: { depth: 0 },
        issues: { ready: [], active: [] },
      }),
      executeControlAction: async (request) => ({
        ok: true,
        action: request.action as string,
        request_id: request.request_id as string,
        acknowledged_at: new Date().toISOString(),
        server_state: "running",
        mode: "auto",
        message: "accepted",
      }),
      appendLearningRecord: async () => ({ ok: true }),
      ingestBeadsHookEvent: async () => {},
    });

    const response = await router.handleRequest({
      method: "GET",
      path: routesModule.HTTP_ROUTE_PATHS.state,
    });

    expect(response?.status).toBe(200);
    const body = response?.body as Record<string, unknown>;
    const orchestrator = body.orchestrator as Record<string, unknown>;
    expect(orchestrator.paused).toBe(true);
  });
});
