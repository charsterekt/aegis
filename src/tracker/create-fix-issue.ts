/**
 * Fix-issue scaffolding for Sentinel corrective work.
 *
 * When Sentinel emits a fail verdict, it must create explicit corrective work
 * rather than silently burying the problem. This helper converts a Sentinel
 * verdict into Beads issue creation inputs while preserving the origin link
 * explicitly.
 */

import type { CreateIssueInput, IssuePriority, AegisIssue } from "./issue-model.js";
import type { SentinelVerdict } from "../castes/sentinel/sentinel-parser.js";

/**
 * Build the standard description string for a Sentinel fix issue.
 */
export function sentinelFixDescription(originIssueId: string, verdictRef: string): string {
  return `Corrective work from Sentinel review of ${originIssueId}. Verdict: ${verdictRef}`;
}

/**
 * Build Beads issue creation inputs from a Sentinel fail verdict.
 *
 * Each issue found in the verdict becomes a separate fix issue. The follow-up
 * issue IDs in the verdict reference the issues this function creates.
 */
export function createFixIssueInputs(
  originIssue: Pick<AegisIssue, "id" | "priority">,
  verdict: SentinelVerdict,
): CreateIssueInput[] {
  if (verdict.verdict !== "fail") {
    return [];
  }

  if (!verdict.issuesFound.length) {
    return [];
  }

  const verdictRef = `sentinel-verdict-${originIssue.id}`;

  return verdict.issuesFound.map((issueDescription) => ({
    title: `Fix: ${issueDescription}`,
    description: sentinelFixDescription(originIssue.id, verdictRef),
    issueClass: "fix",
    priority: originIssue.priority as IssuePriority,
    originId: originIssue.id,
    labels: ["sentinel-fix"],
  }));
}
