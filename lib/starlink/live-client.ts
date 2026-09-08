import type {
  ListTerminalsResult,
  StarlinkAccount,
  StarlinkClient,
  TerminalTelemetry,
} from "./types";
import { StarlinkApiError } from "./types";

const TOKEN_URL = "https://starlink.com/api/auth/connect/token";
const API_BASE = "https://starlink.com/api/public/v2";

type CachedToken = { accessToken: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

function readAccounts(): StarlinkAccount[] {
  const raw = process.env.STARLINK_ACCOUNTS;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

async function getAccessToken(account: StarlinkAccount): Promise<string> {
  const cached = tokenCache.get(account.clientId);
  if (cached && Date.now() < cached.expiresAt - 60_000) {
    return cached.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: account.clientId,
    client_secret: account.clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new StarlinkApiError(
      `Fallo al autenticar (HTTP ${res.status})`,
      account.label,
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) {
    throw new StarlinkApiError(
      "Access token not received in the response",
      account.label,
    );
  }

  const expiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
  tokenCache.set(account.clientId, {
    accessToken: data.access_token,
    expiresAt,
  });
  return data.access_token;
}

async function apiGet(
  account: StarlinkAccount,
  path: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const token = await getAccessToken(account);
  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    tokenCache.delete(account.clientId);
    throw new StarlinkApiError(
      `No autorizado en ${path} (token expirado o inválido)`,
      account.label,
    );
  }
  if (!res.ok) {
    throw new StarlinkApiError(
      `Error ${res.status} al consultar ${path}`,
      account.label,
    );
  }
  return res.json();
}

async function apiPost(
  account: StarlinkAccount,
  path: string,
  body: unknown,
): Promise<unknown> {
  const token = await getAccessToken(account);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    tokenCache.delete(account.clientId);
    throw new StarlinkApiError(
      `No autorizado en ${path} (token expirado o inválido)`,
      account.label,
    );
  }
  if (!res.ok) {
    throw new StarlinkApiError(
      `Error ${res.status} al consultar ${path}`,
      account.label,
    );
  }
  return res.json();
}

type RawUserTerminal = {
  userTerminalId: string;
  nickname?: string | null;
  serviceLineNumber?: string | null;
};

type UserTerminalsPage = {
  content?: RawUserTerminal[];
  results?: RawUserTerminal[];
  isLastPage?: boolean;
};

type TelemetryQueryResponse = {
  userTerminals?: Record<string, { timestamp: string; signalQuality: number }>;
};

async function listUserTerminals(
  account: StarlinkAccount,
): Promise<Array<{ userTerminalId: string; nickname: string | null; serviceLineNumber: string | null }>> {
  const results: Array<{
    userTerminalId: string;
    nickname: string | null;
    serviceLineNumber: string | null;
  }> = [];

  let page = 0;
  while (true) {
    const data = (await apiGet(account, "/user-terminals", {
      page: String(page),
    })) as UserTerminalsPage;
    const rawItems = data.content ?? data.results ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [];
    if (!Array.isArray(rawItems)) {
      console.error(
        `[starlink] respuesta inesperada de /user-terminals para ${account.label}:`,
        JSON.stringify(data),
      );
    }
    for (const t of items) {
      results.push({
        userTerminalId: t.userTerminalId,
        nickname: t.nickname ?? null,
        serviceLineNumber: t.serviceLineNumber ?? null,
      });
    }
    const isLastPage = data.isLastPage ?? true;
    if (isLastPage || items.length === 0) break;
    page += 1;
  }

  return results;
}

async function queryTelemetry(
  account: StarlinkAccount,
): Promise<Record<string, { timestamp: string; signalQuality: number }>> {
  const data = (await apiPost(account, "/telemetry/query", {
    includeUserTerminals: true,
  })) as TelemetryQueryResponse;
  if (!data.userTerminals) {
    console.error(
      `[starlink] respuesta inesperada de /telemetry/query para ${account.label}:`,
      JSON.stringify(data),
    );
  }
  return data.userTerminals ?? {};
}

async function listTerminalsForAccount(
  account: StarlinkAccount,
): Promise<TerminalTelemetry[]> {
  const [terminals, telemetry] = await Promise.all([
    listUserTerminals(account),
    queryTelemetry(account),
  ]);

  return terminals.map((terminal) => {
    const reading = telemetry[terminal.userTerminalId];
    return {
      terminalId: terminal.userTerminalId,
      accountLabel: account.label,
      serviceLineNumber: terminal.serviceLineNumber,
      nickname: terminal.nickname,
      online: Boolean(reading),
      lastSeenAt: reading?.timestamp ?? null,
      signalQuality: reading?.signalQuality ?? null,
    };
  });
}

export class LiveStarlinkClient implements StarlinkClient {
  async listTerminals(): Promise<ListTerminalsResult> {
    const accounts = readAccounts();
    const settled = await Promise.allSettled(
      accounts.map((account) => listTerminalsForAccount(account)),
    );

    const terminals: TerminalTelemetry[] = [];
    const errors: ListTerminalsResult["errors"] = [];

    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        terminals.push(...result.value);
      } else {
        const reason = result.reason;
        console.error(`[starlink] sync falló para ${accounts[i]?.label}:`, reason);
        errors.push({
          accountLabel: accounts[i]?.label ?? "desconocida",
          message:
            reason instanceof StarlinkApiError
              ? reason.message
              : String(reason),
        });
      }
    });

    return { terminals, errors };
  }
}

export function hasStarlinkCredentials(): boolean {
  return readAccounts().length > 0;
}
