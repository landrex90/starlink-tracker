import type { StarlinkClient } from "./types";
import { hasStarlinkCredentials, LiveStarlinkClient } from "./live-client";
import { MockStarlinkClient } from "./mock-client";

export function getStarlinkClient(): StarlinkClient {
  return hasStarlinkCredentials() ? new LiveStarlinkClient() : new MockStarlinkClient();
}

export { hasStarlinkCredentials } from "./live-client";
export * from "./types";
