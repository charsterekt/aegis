import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoopPanel } from "../loop-panel";

describe("LoopPanel", () => {
  it("renders Start when the loop is idle and does not render Start Run", () => {
    render(
      <LoopPanel
        loopState="idle"
        phaseLogs={{ poll: [], dispatch: [], monitor: [], reap: [] }}
        onStart={vi.fn().mockResolvedValue(undefined)}
        onPause={vi.fn().mockResolvedValue(undefined)}
        onResume={vi.fn().mockResolvedValue(undefined)}
        onStop={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
    expect(screen.queryByText("Start Run")).toBeNull();
  });
});
