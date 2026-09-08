export type TerminalTelemetry = {
  terminalId: string;
  accountLabel: string;
  serviceLineNumber: string | null;
  nickname: string | null;
  online: boolean;
  lastSeenAt: string | null; // ISO timestamp, only set when online is true
  signalQuality: number | null; // 0-1, higher is better
};

export type StarlinkAccount = {
  label: string;
  clientId: string;
  clientSecret: string;
};

export type ListTerminalsResult = {
  terminals: TerminalTelemetry[];
  errors: { accountLabel: string; message: string }[];
};

export interface StarlinkClient {
  /** One entry per known terminal across service lines + user-terminals, merged with latest telemetry. */
  listTerminals(): Promise<ListTerminalsResult>;
}

export class StarlinkApiError extends Error {
  constructor(
    message: string,
    public readonly accountLabel: string,
  ) {
    super(message);
    this.name = "StarlinkApiError";
  }
}
