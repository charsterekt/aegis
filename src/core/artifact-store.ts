import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface PersistArtifactInput {
  family: "oracle" | "titan" | "sentinel" | "janus" | "transcripts";
  issueId: string;
  artifactId?: string;
  artifact: unknown;
}

function resolveArtifactPath(
  root: string,
  family: PersistArtifactInput["family"],
  issueId: string,
  artifactId?: string,
) {
  const fileName = artifactId ? `${issueId}--${artifactId}.json` : `${issueId}.json`;
  return path.join(path.resolve(root), ".aegis", family, fileName);
}

export function persistArtifact(root: string, input: PersistArtifactInput) {
  const artifactPath = resolveArtifactPath(root, input.family, input.issueId, input.artifactId);
  const temporaryPath = `${artifactPath}.tmp`;
  const artifactFileName = path.basename(artifactPath);

  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(temporaryPath, `${JSON.stringify(input.artifact, null, 2)}\n`, "utf8");
  renameSync(temporaryPath, artifactPath);

  return path.join(".aegis", input.family, artifactFileName);
}
