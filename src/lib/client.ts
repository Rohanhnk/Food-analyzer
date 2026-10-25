import type { TrackerClient } from "./contracts";
import { demoClient } from "./demo-client";
import { HttpClient } from "./http-client";

let liveClientInstance: TrackerClient | null = null;

export function getClient(): TrackerClient {
  const mode = process.env.NEXT_PUBLIC_DATA_MODE ?? "demo";

  if (mode === "live") {
    if (!liveClientInstance) {
      liveClientInstance = new HttpClient();
    }
    return liveClientInstance;
  }

  // Default demo adapter
  return demoClient;
}
