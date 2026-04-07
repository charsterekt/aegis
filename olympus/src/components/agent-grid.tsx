/**
 * Agent grid component contract.
 *
 * Lane B implements: responsive grid of agent cards, empty state,
 * and completed agent fade-out behavior.
 */

import type { ActiveAgentInfo } from "../types/dashboard-state";

export interface AgentGridProps {
  agents: ActiveAgentInfo[];
  onKill: (agentId: string) => void;
}

export function AgentGrid(_props: AgentGridProps): JSX.Element {
  // Lane B: implement agent grid with responsive layout
  return (
    <section data-testid="agent-grid" aria-label="Active Agents">
      {/* Lane B: implement agent grid */}
    </section>
  );
}
