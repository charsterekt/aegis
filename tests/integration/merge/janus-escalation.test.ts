/**
 * S15B contract seed — Janus escalation integration tests.
 *
 * Tests the integration of:
 *   - tiered conflict policy classification
 *   - Janus dispatch eligibility
 *   - escalation triggers and retry thresholds
 *   - safe requeue behavior after Janus success
 *   - human-decision artifact generation for semantic ambiguity
 *
 * Per SPECv2 §10.4, §10.5, §12.5, §12.5.1, §12.8.
 */

import { describe, expect, it, beforeEach } from "vitest";

import {
  classifyConflictTier,
  isJanusEligible,
  shouldEscalateToJanus,
  detectConflicts,
  detectSemanticAmbiguity,
  defaultJanusInvocationPolicy,
  type JanusInvocationPolicy,
  type ConflictClassification,
} from "../../../src/merge/tiered-conflict-policy.js";

import {
  parseJanusResolutionArtifact,
  JanusParseError,
} from "../../../src/castes/janus/janus-parser.js";

import {
  createJanusPromptContract,
  buildJanusPrompt,
} from "../../../src/castes/janus/janus-prompt.js";

// ---------------------------------------------------------------------------
// Tiered conflict policy tests
// ---------------------------------------------------------------------------

describe("Tiered conflict policy", () => {
  describe("defaultJanusInvocationPolicy", () => {
    it("returns Janus disabled by default for safety", () => {
      const policy = defaultJanusInvocationPolicy();
      expect(policy.janusEnabled).toBe(false);
    });

    it("has retry threshold of 2 matching config default", () => {
      const policy = defaultJanusInvocationPolicy();
      expect(policy.maxRetryAttempts).toBe(2);
    });

    it("allows economic guardrails by default", () => {
      const policy = defaultJanusInvocationPolicy();
      expect(policy.economicGuardrailsAllow).toBe(true);
    });
  });

  describe("detectConflicts", () => {
    it("detects CONFLICT marker in output", () => {
      expect(detectConflicts("CONFLICT (content): Merge conflict in file.ts")).toBe(true);
    });

    it("detects Automatic merge failed", () => {
      expect(detectConflicts("Automatic merge failed: file.ts")).toBe(true);
    });

    it("detects Merge conflict text", () => {
      expect(detectConflicts("Merge conflict in src/utils.ts")).toBe(true);
    });

    it("detects conflict marker arrows", () => {
      expect(detectConflicts("<<<<<<< HEAD\nsome code\n=======")).toBe(true);
    });

    it("returns false for clean merge output", () => {
      expect(detectConflicts("Updating main..feature\nFast-forward")).toBe(false);
    });
  });

  describe("detectSemanticAmbiguity", () => {
    it("detects type error indicator", () => {
      expect(detectSemanticAmbiguity("error TS2345: type error in assignment")).toBe(true);
    });

    it("detects duplicate indicator", () => {
      expect(detectSemanticAmbiguity("Duplicate function declaration 'processData'")).toBe(true);
    });

    it("detects module not found", () => {
      expect(detectSemanticAmbiguity("Module not found: @aegis/core")).toBe(true);
    });

    it("detects circular dependency", () => {
      expect(detectSemanticAmbiguity("Circular dependency detected: a -> b -> a")).toBe(true);
    });

    it("returns false for normal merge output", () => {
      expect(detectSemanticAmbiguity("Merged 15 files successfully")).toBe(false);
    });
  });

  describe("isJanusEligible", () => {
    it("returns false when Janus is disabled", () => {
      const policy: JanusInvocationPolicy = {
        janusEnabled: false,
        maxRetryAttempts: 2,
        maxConflictFiles: 10,
        economicGuardrailsAllow: true,
      };
      expect(isJanusEligible(5, policy)).toBe(false);
    });

    it("returns false when attempt count is below threshold", () => {
      const policy: JanusInvocationPolicy = {
        janusEnabled: true,
        maxRetryAttempts: 3,
        maxConflictFiles: 10,
        economicGuardrailsAllow: true,
      };
      expect(isJanusEligible(2, policy)).toBe(false);
    });

    it("returns false when economic guardrails disallow", () => {
      const policy: JanusInvocationPolicy = {
        janusEnabled: true,
        maxRetryAttempts: 2,
        maxConflictFiles: 10,
        economicGuardrailsAllow: false,
      };
      expect(isJanusEligible(3, policy)).toBe(false);
    });

    it("returns true when all conditions are met", () => {
      const policy: JanusInvocationPolicy = {
        janusEnabled: true,
        maxRetryAttempts: 2,
        maxConflictFiles: 10,
        economicGuardrailsAllow: true,
      };
      expect(isJanusEligible(2, policy)).toBe(true);
    });

    it("returns true when attempt count exceeds threshold", () => {
      const policy: JanusInvocationPolicy = {
        janusEnabled: true,
        maxRetryAttempts: 2,
        maxConflictFiles: 10,
        economicGuardrailsAllow: true,
      };
      expect(isJanusEligible(5, policy)).toBe(true);
    });
  });

  describe("shouldEscalateToJanus", () => {
    it("returns true for semantic ambiguity", () => {
      expect(shouldEscalateToJanus(true, true, 3, 1, defaultJanusInvocationPolicy())).toBe(true);
    });

    it("returns true when conflict file count exceeds threshold", () => {
      const policy: JanusInvocationPolicy = {
        janusEnabled: true,
        maxRetryAttempts: 3,
        maxConflictFiles: 5,
        economicGuardrailsAllow: true,
      };
      expect(shouldEscalateToJanus(true, false, 5, 1, policy)).toBe(true);
    });

    it("returns true when retry threshold is reached with conflicts", () => {
      const policy: JanusInvocationPolicy = {
        janusEnabled: true,
        maxRetryAttempts: 2,
        maxConflictFiles: 10,
        economicGuardrailsAllow: true,
      };
      expect(shouldEscalateToJanus(true, false, 3, 2, policy)).toBe(true);
    });

    it("returns false when no escalation triggers are met", () => {
      const policy: JanusInvocationPolicy = {
        janusEnabled: true,
        maxRetryAttempts: 3,
        maxConflictFiles: 10,
        economicGuardrailsAllow: true,
      };
      expect(shouldEscalateToJanus(true, false, 3, 1, policy)).toBe(false);
    });

    it("returns false when there are no conflicts", () => {
      expect(shouldEscalateToJanus(false, false, 0, 0, defaultJanusInvocationPolicy())).toBe(false);
    });
  });

  describe("classifyConflictTier", () => {
    it("classifies clean merge as Tier 1", () => {
      const result = classifyConflictTier("Fast-forward merge", 0, 0, 0, defaultJanusInvocationPolicy());
      expect(result.tier).toBe(1);
      expect(result.janusEligible).toBe(false);
    });

    it("classifies hard conflict as Tier 2", () => {
      const result = classifyConflictTier(
        "CONFLICT (content): Merge conflict in file.ts",
        1,
        3,
        1,
        defaultJanusInvocationPolicy(),
      );
      expect(result.tier).toBe(2);
      expect(result.janusEligible).toBe(false);
    });

    it("classifies repeated failures as Tier 3 with Janus not eligible when disabled", () => {
      const result = classifyConflictTier(
        "CONFLICT (content): Merge conflict in file.ts",
        1,
        3,
        3,
        { ...defaultJanusInvocationPolicy(), janusEnabled: false },
      );
      expect(result.tier).toBe(3);
      expect(result.janusEligible).toBe(false);
    });

    it("classifies repeated failures as Tier 3 with Janus eligible when enabled", () => {
      const result = classifyConflictTier(
        "CONFLICT (content): Merge conflict in file.ts",
        1,
        3,
        3,
        { ...defaultJanusInvocationPolicy(), janusEnabled: true },
      );
      expect(result.tier).toBe(3);
      expect(result.janusEligible).toBe(true);
    });

    it("classifies semantic ambiguity as Tier 3", () => {
      const result = classifyConflictTier(
        "error TS2345: type error in merged code",
        1,
        1,
        1,
        defaultJanusInvocationPolicy(),
      );
      expect(result.tier).toBe(3);
    });

    it("classifies stale branch as Tier 1", () => {
      const result = classifyConflictTier(
        "Branch is behind main",
        1,
        0,
        0,
        defaultJanusInvocationPolicy(),
      );
      expect(result.tier).toBe(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Janus prompt tests
// ---------------------------------------------------------------------------

describe("Janus prompt construction", () => {
  it("creates a prompt contract with correct budget defaults", () => {
    const contract = createJanusPromptContract({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Merge conflict in dispatch-state.ts",
      filesInvolved: ["src/dispatch-state.ts"],
      previousMergeErrors: "CONFLICT (content): Merge conflict in src/dispatch-state.ts",
      conflictTier: 3,
    });

    expect(contract.maxTurns).toBe(12);
    expect(contract.maxTokens).toBe(120_000);
    expect(contract.originatingIssueId).toBe("aegis-fjm.5");
    expect(contract.conflictTier).toBe(3);
  });

  it("renders a prompt containing all required context", () => {
    const contract = createJanusPromptContract({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Merge conflict in dispatch-state.ts",
      filesInvolved: ["src/dispatch-state.ts", "src/merge/queue-worker.ts"],
      previousMergeErrors: "CONFLICT (content): file.ts",
      conflictTier: 2,
    });

    const prompt = buildJanusPrompt(contract);

    expect(prompt).toContain("aegis-fjm.5");
    expect(prompt).toContain(".aegis/labors/labor-aegis-fjm.5");
    expect(prompt).toContain("Merge conflict in dispatch-state.ts");
    expect(prompt).toContain("src/dispatch-state.ts");
    expect(prompt).toContain("src/merge/queue-worker.ts");
    expect(prompt).toContain("12");
    expect(prompt).toContain("120000");
    expect(prompt).toContain("do NOT merge directly outside the queue");
    expect(prompt).toContain("do NOT replace Titan");
  });

  it("includes all required sections in the prompt", () => {
    const contract = createJanusPromptContract({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Test conflict",
      filesInvolved: [],
      previousMergeErrors: "",
      conflictTier: 3,
    });

    const prompt = buildJanusPrompt(contract);

    for (const section of contract.sections) {
      expect(prompt).toContain(section);
    }
  });

  it("includes all required rules in the prompt", () => {
    const contract = createJanusPromptContract({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Test conflict",
      filesInvolved: [],
      previousMergeErrors: "",
      conflictTier: 3,
    });

    const prompt = buildJanusPrompt(contract);

    for (const rule of contract.rules) {
      expect(prompt).toContain(rule);
    }
  });
});

// ---------------------------------------------------------------------------
// Janus dispatch and escalation flow tests
// ---------------------------------------------------------------------------

describe("Janus dispatch and escalation flow", () => {
  it("produces a valid artifact for a requeue scenario", () => {
    const janusOutput = JSON.stringify({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Resolved conflict in dispatch-state.ts",
      resolutionStrategy: "Accepted incoming branch changes with minor manual adjustments",
      filesTouched: ["src/dispatch-state.ts"],
      validationsRun: ["npm run test", "npm run lint"],
      residualRisks: [],
      recommendedNextAction: "requeue",
    });

    const artifact = parseJanusResolutionArtifact(janusOutput);
    expect(artifact.recommendedNextAction).toBe("requeue");
    expect(artifact.filesTouched).toContain("src/dispatch-state.ts");
  });

  it("produces a valid artifact for a manual_decision scenario", () => {
    const janusOutput = JSON.stringify({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Semantic ambiguity between two valid merge strategies",
      resolutionStrategy: "Unable to determine correct strategy without domain context",
      filesTouched: ["src/dispatch-state.ts", "src/triage.ts"],
      validationsRun: ["npm run build"],
      residualRisks: ["Merged logic may conflict with existing dispatch behavior"],
      recommendedNextAction: "manual_decision",
    });

    const artifact = parseJanusResolutionArtifact(janusOutput);
    expect(artifact.recommendedNextAction).toBe("manual_decision");
    expect(artifact.residualRisks.length).toBeGreaterThan(0);
  });

  it("produces a valid artifact for a fail scenario", () => {
    const janusOutput = JSON.stringify({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Budget exhausted before resolution could complete",
      resolutionStrategy: "Attempted resolution but hit token limit",
      filesTouched: [],
      validationsRun: [],
      residualRisks: ["Conflict remains unresolved"],
      recommendedNextAction: "fail",
    });

    const artifact = parseJanusResolutionArtifact(janusOutput);
    expect(artifact.recommendedNextAction).toBe("fail");
  });

  it("rejects a Janus artifact with wrong recommendedNextAction", () => {
    const janusOutput = JSON.stringify({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Test",
      resolutionStrategy: "Test",
      filesTouched: [],
      validationsRun: [],
      residualRisks: [],
      recommendedNextAction: "merge_directly",
    });

    expect(() => parseJanusResolutionArtifact(janusOutput)).toThrow(JanusParseError);
  });

  it("rejects a Janus artifact with extra fields", () => {
    const janusOutput = JSON.stringify({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Test",
      resolutionStrategy: "Test",
      filesTouched: [],
      validationsRun: [],
      residualRisks: [],
      recommendedNextAction: "requeue",
      chatLog: ["some conversational context"],
    });

    expect(() => parseJanusResolutionArtifact(janusOutput)).toThrow(JanusParseError);
  });

  it("Janus escalation only triggers when policy allows", () => {
    // Scenario: Tier 3 classification but Janus disabled
    const disabledPolicy: JanusInvocationPolicy = {
      janusEnabled: false,
      maxRetryAttempts: 2,
      maxConflictFiles: 10,
      economicGuardrailsAllow: true,
    };

    const classification = classifyConflictTier(
      "CONFLICT (content): complex merge conflict",
      1,
      3,
      3,
      disabledPolicy,
    );

    // Tier 3 is classified, but Janus is not eligible
    expect(classification.tier).toBe(3);
    expect(classification.janusEligible).toBe(false);
    expect(isJanusEligible(3, disabledPolicy)).toBe(false);
  });

  it("Janus returns to queue on requeue recommendation", () => {
    // Simulate: Janus succeeds, artifact says requeue
    // The queue worker should accept the candidate for a fresh mechanical pass
    const janusOutput = JSON.stringify({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Conflict resolved successfully",
      resolutionStrategy: "Manual merge resolution applied",
      filesTouched: ["src/dispatch-state.ts"],
      validationsRun: ["npm run test", "npm run lint", "npm run build"],
      residualRisks: [],
      recommendedNextAction: "requeue",
    });

    const artifact = parseJanusResolutionArtifact(janusOutput);

    // Requeue means the item goes back into the queue for mechanical verification
    expect(artifact.recommendedNextAction).toBe("requeue");
    expect(artifact.validationsRun).toContain("npm run test");
    expect(artifact.validationsRun).toContain("npm run build");
  });

  it("semantic ambiguity produces human-decision artifact not auto-resolution", () => {
    // Scenario: Janus encounters semantic ambiguity
    const classification = classifyConflictTier(
      "error TS2345: type error in merged code after conflict resolution",
      1,
      1,
      1,
      { ...defaultJanusInvocationPolicy(), janusEnabled: true },
    );

    expect(classification.tier).toBe(3);

    // Janus runs and produces a manual_decision artifact
    const janusOutput = JSON.stringify({
      originatingIssueId: "aegis-fjm.5",
      queueItemId: "aegis-fjm.5",
      preservedLaborPath: ".aegis/labors/labor-aegis-fjm.5",
      conflictSummary: "Semantic type incompatibility between merged branches",
      resolutionStrategy: "Cannot determine correct type resolution without human input",
      filesTouched: ["src/types.ts"],
      validationsRun: [],
      residualRisks: ["Type compatibility uncertain after merge"],
      recommendedNextAction: "manual_decision",
    });

    const artifact = parseJanusResolutionArtifact(janusOutput);
    expect(artifact.recommendedNextAction).toBe("manual_decision");
    // This is NOT auto-resolution; it explicitly requires human decision
  });
});
