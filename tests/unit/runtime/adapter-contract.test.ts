import { describe, expect, it } from "vitest";

import {
  RUNTIME_ADAPTER_CONTRACT_METHODS,
  toAdapterArtifactRefs,
} from "../../../src/runtime/adapter-contract.js";

describe("runtime adapter contract", () => {
  it("names the canonical adapter lifecycle methods", () => {
    expect(RUNTIME_ADAPTER_CONTRACT_METHODS).toEqual([
      "spawn",
      "abort",
      "status",
      "finalResult",
    ]);
  });

  it("normalizes absent artifact references to an empty list", () => {
    expect(toAdapterArtifactRefs()).toEqual([]);
  });
});
