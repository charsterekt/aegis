import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { LiveEventPublisher } from "../events/event-bus.js";
import { SSE_EVENT_STREAM_PATH } from "../events/sse-stream.js";
import {
  HTTP_ROUTE_PATHS,
  type ServerLifecycleState,
} from "./routes.js";

export const HTTP_SERVER_INITIAL_STATE: ServerLifecycleState = "stopped";

export interface HttpServerContract {
  initial_state: ServerLifecycleState;
  event_stream_path: string;
  routes: typeof HTTP_ROUTE_PATHS;
}

export interface HttpServerBindings {
  eventPublisher?: LiveEventPublisher;
}

export interface HttpServerStartOptions {
  root?: string;
  host?: string;
  port: number;
}

export interface HttpServerController {
  start(options: HttpServerStartOptions): Promise<{ host: string; port: number; url: string }>;
  stop(): Promise<void>;
  status(): ServerLifecycleState;
}

export function createHttpServerContract(): HttpServerContract {
  return {
    initial_state: HTTP_SERVER_INITIAL_STATE,
    event_stream_path: SSE_EVENT_STREAM_PATH,
    routes: HTTP_ROUTE_PATHS,
  };
}

const OLYMPUS_DIST_INDEX = "olympus/dist/index.html";
const OLYMPUS_FALLBACK_SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Olympus</title>
  </head>
  <body>
    <main>
      <h1>Olympus</h1>
      <p>Aegis dashboard shell initialized.</p>
    </main>
  </body>
</html>
`;

function resolveOlympusShell(root: string) {
  const shellPath = path.join(path.resolve(root), ...OLYMPUS_DIST_INDEX.split("/"));

  if (existsSync(shellPath)) {
    return readFileSync(shellPath, "utf8");
  }

  return OLYMPUS_FALLBACK_SHELL;
}

function renderRootRoute(
  request: IncomingMessage,
  response: ServerResponse,
  shellHtml: string,
) {
  if (request.method !== "GET" || request.url !== HTTP_ROUTE_PATHS.root) {
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        ok: false,
        error: "Not found",
      }),
    );
    return;
  }

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(shellHtml);
}

export function createHttpServerController(
  _bindings: HttpServerBindings = {},
): HttpServerController {
  let lifecycleState: ServerLifecycleState = HTTP_SERVER_INITIAL_STATE;
  let activeServer: ReturnType<typeof createServer> | null = null;

  return {
    async start(options: HttpServerStartOptions) {
      if (activeServer || lifecycleState === "running" || lifecycleState === "starting") {
        throw new Error("HTTP server is already running.");
      }

      lifecycleState = "starting";
      const host = options.host ?? "127.0.0.1";
      const shellHtml = resolveOlympusShell(options.root ?? process.cwd());
      const server = createServer((request, response) => {
        renderRootRoute(request, response, shellHtml);
      });

      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          server.off("listening", onListening);
          reject(error);
        };
        const onListening = () => {
          server.off("error", onError);
          resolve();
        };

        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(options.port, host);
      });

      lifecycleState = "running";
      activeServer = server;

      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("Unable to resolve bound HTTP server address.");
      }

      return {
        host,
        port: address.port,
        url: `http://${host}:${address.port}${HTTP_ROUTE_PATHS.root}`,
      };
    },
    async stop() {
      if (!activeServer || lifecycleState === "stopped") {
        lifecycleState = "stopped";
        return;
      }

      lifecycleState = "stopping";

      const serverToClose = activeServer;
      await new Promise<void>((resolve, reject) => {
        serverToClose.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });

      activeServer = null;
      lifecycleState = "stopped";
    },
    status() {
      return lifecycleState;
    },
  };
}

export function createUnimplementedHttpServerController(): HttpServerController {
  return createHttpServerController();
}
