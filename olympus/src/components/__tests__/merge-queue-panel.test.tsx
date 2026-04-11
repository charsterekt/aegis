import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MergeQueuePanel } from "../merge-queue-panel";

describe("MergeQueuePanel", () => {
  it("renders the merge queue section with heading", () => {
    render(
      <MergeQueuePanel
        queueLength={0}
        currentItem={null}
        lines={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Merge Queue" })).toBeTruthy();
  });

  it("renders the current item when present", () => {
    render(
      <MergeQueuePanel
        queueLength={2}
        currentItem="foundation.contract"
        lines={["> merging foundation.contract"]}
      />,
    );

    expect(screen.getAllByText(/foundation\.contract/).length).toBeGreaterThan(0);
    expect(screen.getByText(/2 items in queue/)).toBeTruthy();
  });

  it("renders queue log lines", () => {
    render(
      <MergeQueuePanel
        queueLength={1}
        currentItem="todo-system"
        lines={["> queue updated", "> merging todo-system"]}
      />,
    );

    expect(screen.getByText("> queue updated")).toBeTruthy();
    expect(screen.getByText("> merging todo-system")).toBeTruthy();
  });

  it("shows empty state when queue is empty", () => {
    render(
      <MergeQueuePanel
        queueLength={0}
        currentItem={null}
        lines={[]}
      />,
    );

    expect(screen.getAllByText("Queue empty").length).toBeGreaterThan(0);
  });

  it("has aria-label for accessibility", () => {
    const { container } = render(
      <MergeQueuePanel
        queueLength={0}
        currentItem={null}
        lines={[]}
      />,
    );

    expect(container.querySelector('[aria-label="Merge Queue"]')).toBeTruthy();
  });

  it("does not show current item when currentItem is null", () => {
    render(
      <MergeQueuePanel
        queueLength={0}
        currentItem={null}
        lines={[]}
      />,
    );

    expect(screen.queryByText("Current:")).toBeNull();
  });

  it("renders queue length badge for non-empty queue", () => {
    render(
      <MergeQueuePanel
        queueLength={5}
        currentItem={null}
        lines={[]}
      />,
    );

    expect(screen.getAllByText(/5 items in queue/).length).toBeGreaterThan(0);
  });
});
