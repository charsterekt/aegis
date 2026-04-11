import type { JSX } from "react";
import { colors, radius, spacing } from "../theme/tokens";

export type LoopState = "idle" | "running" | "paused" | "stopping";

export interface LoopPhaseLogs {
  poll: string[];
  dispatch: string[];
  monitor: string[];
  reap: string[];
}

export interface LoopPanelProps {
  loopState: LoopState;
  phaseLogs: LoopPhaseLogs;
  onStart: () => Promise<void>;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
  disabled?: boolean;
}

function PhaseColumn(props: { title: string; lines: string[] }): JSX.Element {
  const { title, lines } = props;

  return (
    <section
      className="loop-panel-phase"
      style={{
        background: colors.bgSecondary,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: radius.md,
        padding: spacing.md,
      }}
    >
      <h3 style={{ margin: 0, marginBottom: spacing.sm }}>{title}</h3>
      {lines.length > 0 ? (
        <div style={{ display: "grid", gap: spacing.xs }}>
          {lines.map((line, index) => (
            <code key={`${title}-${index}`} style={{ color: colors.textSecondary }}>
              {line}
            </code>
          ))}
        </div>
      ) : (
        <div style={{ color: colors.textMuted }}>No recent activity</div>
      )}
    </section>
  );
}

export function LoopPanel(props: LoopPanelProps): JSX.Element {
  const {
    loopState,
    phaseLogs,
    onStart,
    onPause,
    onResume,
    onStop,
    disabled = false,
  } = props;

  return (
    <section
      aria-label="Aegis Loop"
      className="loop-panel"
      data-testid="loop-panel"
      role="region"
      style={{
        display: "grid",
        gap: spacing.md,
        padding: spacing.lg,
        background: colors.bgSecondary,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: radius.lg,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.md,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Aegis Loop</h2>
          <div style={{ color: colors.textSecondary, marginTop: spacing.xs }}>
            {loopState === "idle" && "Loop idle"}
            {loopState === "running" && "Loop running"}
            {loopState === "paused" && "Loop paused"}
            {loopState === "stopping" && "Loop stopping"}
          </div>
        </div>

        <div style={{ display: "flex", gap: spacing.sm, flexWrap: "wrap" }}>
          {loopState === "idle" && (
            <button disabled={disabled} onClick={() => void onStart()} type="button">
              Start
            </button>
          )}
          {loopState === "running" && (
            <button disabled={disabled} onClick={() => void onPause()} type="button">
              Pause
            </button>
          )}
          {loopState === "paused" && (
            <button disabled={disabled} onClick={() => void onResume()} type="button">
              Resume
            </button>
          )}
          {loopState !== "idle" && (
            <button disabled={disabled || loopState === "stopping"} onClick={() => void onStop()} type="button">
              Stop
            </button>
          )}
        </div>
      </header>

      <div
        className="loop-panel-phase-table"
        style={{
          display: "grid",
          gap: spacing.md,
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        }}
      >
        <PhaseColumn title="Poll" lines={phaseLogs.poll} />
        <PhaseColumn title="Dispatch" lines={phaseLogs.dispatch} />
        <PhaseColumn title="Monitor" lines={phaseLogs.monitor} />
        <PhaseColumn title="Reap" lines={phaseLogs.reap} />
      </div>
    </section>
  );
}
