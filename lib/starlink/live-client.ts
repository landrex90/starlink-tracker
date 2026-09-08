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
  kitSerialNumber?: string | null;
};

// Every Starlink V2 endpoint wraps its real payload in this envelope.
type ServiceResponse<T> = {
  content?: T;
  errors?: unknown[];
  isValid?: boolean;
};

type UserTerminalsPage = {
  results?: RawUserTerminal[];
  isLastPage?: boolean;
};

type TelemetryQueryContent = {
  userTerminals?: Record<string, { timestamp: string; signalQuality: number }>;
};

type RawServiceLine = {
  serviceLineNumber: string;
  nickname?: string | null;
  addressReferenceId?: string | null;
};

type ServiceLinesPage = {
  results?: RawServiceLine[];
  isLastPage?: boolean;
};

type ServiceLineInfo = { nickname: string | null; addressReferenceId: string | null };

// The human-readable name installers set in the Starlink portal usually lives
// on the service line, not the physical terminal (whose nickname is almost
// always null in practice). The service line is also the only place linking
// a terminal to its installed address.
async function listServiceLineInfo(
  account: StarlinkAccount,
): Promise<Record<string, ServiceLineInfo>> {
  const info: Record<string, ServiceLineInfo> = {};

  let page = 0;
  while (true) {
    const response = (await apiGet(account, "/service-lines", {
      page: String(page),
    })) as ServiceResponse<ServiceLinesPage>;
    const rawItems = response.content?.results ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [];
    for (const line of items) {
      info[line.serviceLineNumber] = {
        nickname: line.nickname ?? null,
        addressReferenceId: line.addressReferenceId ?? null,
      };
    }
    const isLastPage = response.content?.isLastPage ?? true;
    if (isLastPage || items.length === 0) break;
    page += 1;
  }

  return info;
}

type RawAddress = {
  addressReferenceId: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type AddressesPage = {
  results?: RawAddress[];
  isLastPage?: boolean;
};

type AddressInfo = { formattedAddress: string | null; latitude: number | null; longitude: number | null };

async function listAddresses(account: StarlinkAccount): Promise<Record<string, AddressInfo>> {
  const addresses: Record<string, AddressInfo> = {};

  let page = 0;
  while (true) {
    const response = (await apiGet(account, "/addresses", {
      page: String(page),
    })) as ServiceResponse<AddressesPage>;
    const rawItems = response.content?.results ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [];
    for (const address of items) {
      addresses[address.addressReferenceId] = {
        formattedAddress: address.formattedAddress ?? null,
        latitude: address.latitude ?? null,
        longitude: address.longitude ?? null,
      };
    }
    const isLastPage = response.content?.isLastPage ?? true;
    if (isLastPage || items.length === 0) break;
    page += 1;
  }

  return addresses;
}

async function listUserTerminals(account: StarlinkAccount): Promise<
  Array<{
    userTerminalId: string;
    nickname: string | null;
    serviceLineNumber: string | null;
    kitSerialNumber: string | null;
  }>
> {
  const results: Array<{
    userTerminalId: string;
    nickname: string | null;
    serviceLineNumber: string | null;
    kitSerialNumber: string | null;
  }> = [];

  let page = 0;
  while (true) {
    const response = (await apiGet(account, "/user-terminals", {
      page: String(page),
    })) as ServiceResponse<UserTerminalsPage>;
    const rawItems = response.content?.results ?? [];
    const items = Array.isArray(rawItems) ? rawItems : [];
    if (!Array.isArray(response.content?.results)) {
      console.error(
        `[starlink] respuesta inesperada de /user-terminals para ${account.label}:`,
        JSON.stringify(response),
      );
    }
    for (const t of items) {
      results.push({
        userTerminalId: t.userTerminalId,
        nickname: t.nickname ?? null,
        serviceLineNumber: t.serviceLineNumber ?? null,
        kitSerialNumber: t.kitSerialNumber ?? null,
      });
    }
    const isLastPage = response.content?.isLastPage ?? true;
    if (isLastPage || items.length === 0) break;
    page += 1;
  }

  return results;
}

async function queryTelemetry(
  account: StarlinkAccount,
): Promise<Record<string, { timestamp: string; signalQuality: number }>> {
  const response = (await apiPost(account, "/telemetry/query", {
    includeUserTerminals: true,
  })) as ServiceResponse<TelemetryQueryContent>;
  if (!response.content?.userTerminals) {
    console.error(
      `[starlink] respuesta inesperada de /telemetry/query para ${account.label}:`,
      JSON.stringify(response),
    );
  }
  return response.content?.userTerminals ?? {};
}

async function listTerminalsForAccount(
  account: StarlinkAccount,
): Promise<TerminalTelemetry[]> {
  const [terminals, telemetry, serviceLines, addresses] = await Promise.all([
    listUserTerminals(account),
    queryTelemetry(account),
    listServiceLineInfo(account),
    listAddresses(account),
  ]);

  return terminals.map((terminal) => {
    const reading = telemetry[terminal.userTerminalId];
    const serviceLine = terminal.serviceLineNumber ? serviceLines[terminal.serviceLineNumber] : undefined;
    const address = serviceLine?.addressReferenceId ? addresses[serviceLine.addressReferenceId] : undefined;
    return {
      terminalId: terminal.userTerminalId,
      accountLabel: account.label,
      serviceLineNumber: terminal.serviceLineNumber,
      // service line nickname (set per-site in the Starlink portal) takes
      // priority — the terminal's own nickname is almost always empty.
      nickname: serviceLine?.nickname ?? terminal.nickname,
      kitSerialNumber: terminal.kitSerialNumber,
      formattedAddress: address?.formattedAddress ?? null,
      latitude: address?.latitude ?? null,
      longitude: address?.longitude ?? null,
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
