import type { TrackerClient } from "./contracts";
import { demoClient } from "./demo-client";
// Replace this binding with Person 2's authenticated HTTP adapter after contract tests pass.
// Never silently display demo records when production mode has been requested.
export function getClient(): TrackerClient {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE ?? "demo";
  if (mode !== "demo") throw new Error("Live data is not connected yet. Use NEXT_PUBLIC_DATA_MODE=demo for this frontend build.");
  return demoClient;
}
