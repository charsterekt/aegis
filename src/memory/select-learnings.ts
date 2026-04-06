/**
 * Select learnings — retrieve relevant Mnemosyne records for prompt injection.
 *
 * SPECv2 §14.3: When constructing prompts:
 * - retrieve relevant learnings by domain or keyword matching
 * - sort recent-first
 * - stay within the configured context token budget
 * - fall back to recent general learnings when no domain-specific match exists
 */

import type { LearningRecord } from "./mnemosyne-store.js";
import type { AegisConfig } from "../config/schema.js";

// ---------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------

/**
 * Estimate token count for a string.
 *
 * MVP uses a rough 4-characters-per-token heuristic. Post-MVP semantic
 * retrieval would replace this with real embedding-based selection.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Select relevant learnings for injection into an agent prompt.
 *
 * Algorithm per SPECv2 §14.3:
 * 1. Filter by domain/keyword matching (case-insensitive substring)
 * 2. Sort by timestamp descending (most recent first)
 * 3. Truncate to stay within the configured prompt token budget
 * 4. Fall back to most recent general learnings if no domain match
 *
 * @param learnings - all loaded learning records
 * @param domain - the domain or keyword to match against
 * @param config - the Mnemosyne config section with prompt_token_budget
 * @returns selected learning records, sorted recent-first, within budget
 */
export function selectLearnings(
  learnings: LearningRecord[],
  domain: string,
  config: { prompt_token_budget: number },
): LearningRecord[] {
  const domainLower = domain.toLowerCase();

  // Step 1: Domain-matched learnings (case-insensitive substring on domain field)
  const matched = learnings.filter((l) => l.domain.toLowerCase().includes(domainLower));

  // Step 2: Sort recent-first
  matched.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  // Step 3: Truncate to budget
  const budgeted = truncateToBudget(matched, config.prompt_token_budget);

  // Step 4: If no domain matches, fall back to most recent general learnings
  if (budgeted.length === 0) {
    const recent = [...learnings].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return truncateToBudget(recent, config.prompt_token_budget);
  }

  return budgeted;
}

/**
 * Truncate a sorted list of learnings to stay within the token budget.
 * Uses a rough 4-chars-per-token estimate for the content field.
 */
function truncateToBudget(
  learnings: LearningRecord[],
  budgetTokens: number,
): LearningRecord[] {
  if (budgetTokens <= 0) return [];

  const result: LearningRecord[] = [];
  let usedTokens = 0;

  for (const learning of learnings) {
    const tokenCost = estimateTokens(learning.content);
    if (usedTokens + tokenCost > budgetTokens) {
      break;
    }
    result.push(learning);
    usedTokens += tokenCost;
  }

  return result;
}

/**
 * Format selected learnings into a prompt-ready string block.
 *
 * Returns an empty string if no learnings are selected.
 */
export function formatLearningsForPrompt(learnings: LearningRecord[]): string {
  if (learnings.length === 0) return "";

  const lines = learnings.map((l, i) => {
    return `${i + 1}. [${l.category}] ${l.content}`;
  });

  return "## Relevant Project Learnings\n\n" + lines.join("\n") + "\n";
}
