/**
 * S05 contract seed — PiRuntime stub class.
 *
 * Implements the AgentRuntime interface for the Pi SDK.
 * This file is the insertion point for Lane A (aegis-fjm.6.2).
 *
 * Stub contract:
 *   - Class shape is complete so Lane A can fill in real session logic without
 *     changing imports in other modules.
 *   - All methods throw "not implemented" until Lane A lands.
 *   - Runtime-specific Pi SDK imports (if any) belong here or in a private
 *     helper module — they must not appear in agent-runtime.ts or the core.
 *
 * Adapter rules: SPECv2 §8.3 and §8.4.
 *   - Pi SDK session creation and subscription live here only.
 *   - Tool restrictions are enforced by the adapter, not by prompt wording.
 *   - Working directory is applied via the runtime from SpawnOptions.
 *   - Behaviour must be consistent across Windows and Unix-like environments.
 */

import type {
  AgentHandle,
  AgentRuntime,
  AgentStats,
  SpawnOptions,
} from "./agent-runtime.js";
import type { AgentEvent } from "./agent-events.js";

// ---------------------------------------------------------------------------
// PiAgentHandle — stub
// ---------------------------------------------------------------------------

/**
 * Live handle to a Pi coding-agent session.
 * Lane A replaces the stub bodies with real Pi SDK calls.
 */
class PiAgentHandle implements AgentHandle {
  /**
   * @param _opts  Spawn options preserved for the lifecycle implementation.
   */
  constructor(private readonly _opts: SpawnOptions) {
    void this._opts;
  }

  async prompt(_msg: string): Promise<void> {
    throw new Error("PiAgentHandle.prompt: not implemented — Lane A (aegis-fjm.6.2)");
  }

  async steer(_msg: string): Promise<void> {
    throw new Error("PiAgentHandle.steer: not implemented — Lane A (aegis-fjm.6.2)");
  }

  async abort(): Promise<void> {
    throw new Error("PiAgentHandle.abort: not implemented — Lane A (aegis-fjm.6.2)");
  }

  subscribe(_listener: (event: AgentEvent) => void): () => void {
    throw new Error("PiAgentHandle.subscribe: not implemented — Lane A (aegis-fjm.6.2)");
  }

  getStats(): AgentStats {
    throw new Error("PiAgentHandle.getStats: not implemented — Lane A (aegis-fjm.6.2)");
  }
}

// ---------------------------------------------------------------------------
// PiRuntime — stub
// ---------------------------------------------------------------------------

/**
 * AgentRuntime implementation that wraps the Pi coding-agent SDK.
 *
 * Lane A will add:
 *   - Pi SDK session creation (process spawn or SDK .start() call)
 *   - Event subscription mapped to the AgentEvent discriminated union
 *   - Tool restriction enforcement via Pi SDK session configuration
 *   - Windows-safe working directory assignment
 *   - Abort and cleanup on process exit or session error
 */
export class PiRuntime implements AgentRuntime {
  async spawn(opts: SpawnOptions): Promise<AgentHandle> {
    void opts;
    throw new Error("PiRuntime.spawn: not implemented — Lane A (aegis-fjm.6.2)");
    // Lane A inserts real session creation here and returns a live PiAgentHandle.
    // Keeping the reference alive so TypeScript does not remove the class:
    return new PiAgentHandle(opts);
  }
}
