import type { ListTerminalsResult, StarlinkClient } from "./types";

/**
 * Used when no STARLINK_ACCOUNTS are configured. Returns no terminals —
 * the app stays fully usable with manually-entered antennas, and "Sync now"
 * simply reports that no accounts are configured yet.
 */
export class MockStarlinkClient implements StarlinkClient {
  async listTerminals(): Promise<ListTerminalsResult> {
    return { terminals: [], errors: [] };
  }
}
