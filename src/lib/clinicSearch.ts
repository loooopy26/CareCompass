/** Browser client for the authenticated, asynchronous clinic-search HTTP API. */

export type ClinicRegion = "SEOUL" | "CHUNCHEON" | "WONJU";
export type ClinicSearchJobStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED";

/** Render before calling getBrowserLocation(): the server probes Naver with the origin coordinates. */
export const CLINIC_SEARCH_LOCATION_NOTICE =
  "내 위치로 검색하면 현재 좌표가 CareCompass 서버에 전송됩니다. 서버는 대중교통 경로를 확인하기 위해 출발 좌표를 네이버에 전송합니다. 길찾기 링크에도 출발 위치가 포함됩니다.";

export interface ClinicLocation {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  capturedAt?: string;
}

export interface SubmitClinicSearchInput {
  query: string;
  location: ClinicLocation;
  region?: ClinicRegion;
  specialtyCode?: string;
  radiusKm?: number;
  limit?: number;
  originLabel?: string;
}

export interface ClinicCandidate {
  clinicKey: string;
  clinicName: string;
  address: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  specialties: ClinicSpecialty[];
  distanceMeters: number | null;
  sourceId: string;
  sourceAsOf: string | null;
  naverSearchUrl: string;
  walkingSearchUrl?: string;
  navigation?: ClinicNavigation;
}

export interface ClinicSpecialty {
  code: string;
  name: string;
  specialistCount: number | null;
}

export interface ClinicSearchResult {
  answer: string;
  generationMode: string;
  candidates: ClinicCandidate[];
  citations?: unknown[];
  distanceType?: string;
  coverage?: string[];
  routeMode?: string;
  routeProvider?: string;
  routeUrlFormat?: string;
  routeResultVerified?: boolean;
  datasetVersion?: string;
  locationNotice?: string;
}

export interface ClinicNavigation {
  transitUrl: string;
  walkingUrl: string;
  selectedMode: "TRANSIT" | "WALK";
  availability: "FOUND" | "NOT_FOUND" | "UNKNOWN";
  automaticFallback: boolean;
  checkStatus?: string;
}

export interface ClinicSearchJob<T = ClinicSearchResult> {
  jobId: string;
  status: ClinicSearchJobStatus;
  pollAfterMs?: number;
  expiresAt?: string;
  result?: T;
  error?: ApiErrorBody;
}

export interface ApiErrorBody {
  code?: string;
  message?: string;
  retryable?: boolean;
}

export interface ClinicSearchClientOptions {
  /** HTTPS origin/base path of the teammate-owned backend, without route suffix. */
  baseUrl: string;
  /** Return the current raw Cognito Access Token. Never read it from localStorage here. */
  getAccessToken: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  initialPollMs?: number;
  maxPollMs?: number;
}

export interface SearchOptions {
  signal?: AbortSignal;
  /** Reuse this UUID when retrying the same submission. */
  idempotencyKey?: string;
}

export class ClinicSearchApiError extends Error {
  readonly name = "ClinicSearchApiError";
  readonly status: number;
  readonly code?: string;
  readonly retryable?: boolean;

  constructor(
    message: string,
    status: number,
    code?: string,
    retryable?: boolean,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export class ClinicSearchTimeoutError extends Error {
  readonly name = "ClinicSearchTimeoutError";
  readonly jobId?: string;

  constructor(jobId?: string) {
    super("Clinic search did not finish before the client timeout.");
    this.jobId = jobId;
  }
}

export class ClinicSearchJobFailedError extends Error {
  readonly name = "ClinicSearchJobFailedError";
  readonly jobId: string;
  readonly failure?: ApiErrorBody;

  constructor(jobId: string, failure?: ApiErrorBody) {
    super(failure?.message || "Clinic search failed.");
    this.jobId = jobId;
    this.failure = failure;
  }
}

/**
 * Calls the backend's POST /v1/clinic-search/jobs and
 * GET /v1/clinic-search/jobs/{jobId} routes. The backend owns AWS credentials
 * and forwards the raw Access Token to the search Lambda.
 */
export class ClinicSearchClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly getAccessToken: ClinicSearchClientOptions["getAccessToken"];
  private readonly timeoutMs: number;
  private readonly initialPollMs: number;
  private readonly maxPollMs: number;

  constructor(options: ClinicSearchClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.getAccessToken = options.getAccessToken;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.initialPollMs = options.initialPollMs ?? 1_500;
    this.maxPollMs = options.maxPollMs ?? 5_000;

    if (this.timeoutMs <= 0 || this.initialPollMs <= 0 || this.maxPollMs < this.initialPollMs) {
      throw new TypeError("timeoutMs and polling intervals must be positive; maxPollMs must be >= initialPollMs.");
    }
  }

  async submit(input: SubmitClinicSearchInput, options: SearchOptions = {}): Promise<ClinicSearchJob> {
    validateSearchInput(input);
    const idempotencyKey = options.idempotencyKey ?? createClinicSearchRequestId();
    validateRequestId(idempotencyKey);
    const payload = await this.request("POST", "/v1/clinic-search/jobs", {
      ...input,
    }, options.signal, idempotencyKey);
    return parseJob(payload, true);
  }

  async get(jobId: string, options: SearchOptions = {}): Promise<ClinicSearchJob> {
    if (!jobId || !jobId.trim()) throw new TypeError("jobId is required.");
    const payload = await this.request(
      "GET",
      `/v1/clinic-search/jobs/${encodeURIComponent(jobId)}`,
      undefined,
      options.signal,
    );
    return parseJob(payload, true);
  }

  /** Submit and poll until a terminal state, abort, or the default 60 second timeout. */
  async search(input: SubmitClinicSearchInput, options: SearchOptions = {}): Promise<ClinicSearchResult> {
    const deadline = createDeadline(options.signal, this.timeoutMs);
    let jobId: string | undefined;
    try {
      const submitted = await this.submit(input, {
        signal: deadline.signal,
        idempotencyKey: options.idempotencyKey,
      });
      jobId = submitted.jobId;
      return await this.waitForResult(submitted, deadline.signal);
    } catch (error) {
      if (deadline.didTimeout()) throw new ClinicSearchTimeoutError(jobId);
      throw error;
    } finally {
      deadline.dispose();
    }
  }

  /** Poll a job already submitted with submit(). */
  async waitForResult(
    initialJob: ClinicSearchJob,
    signal?: AbortSignal,
  ): Promise<ClinicSearchResult> {
    let job = initialJob;
    let delayMs = clampPollDelay(job.pollAfterMs ?? this.initialPollMs, this.initialPollMs, this.maxPollMs);

    while (true) {
      throwIfAborted(signal);
      const terminalResult = getTerminalResult(job);
      if (terminalResult) return terminalResult;
      checkExpiry(job);

      await abortableDelay(delayMs, signal);
      const next = await this.get(job.jobId, { signal });
      if (next.jobId !== job.jobId) {
        throw new ClinicSearchApiError("The backend returned a different clinic-search job.", 502, "INVALID_RESPONSE", false);
      }
      job = next;
      const result = getTerminalResult(job);
      if (result) return result;
      checkExpiry(job);

      // Respect a longer server hint while applying bounded client backoff.
      delayMs = clampPollDelay(
        Math.max(job.pollAfterMs ?? 0, Math.ceil(delayMs * 1.5)),
        this.initialPollMs,
        this.maxPollMs,
      );
    }
  }

  private async request(
    method: "GET" | "POST",
    path: string,
    body: unknown,
    signal?: AbortSignal,
    idempotencyKey?: string,
  ): Promise<unknown> {
    throwIfAborted(signal);
    const accessToken = await withAbort(Promise.resolve(this.getAccessToken()), signal);
    throwIfAborted(signal);
    if (!accessToken || !accessToken.trim() || /\s/.test(accessToken.trim())) {
      throw new ClinicSearchApiError("A valid signed-in session is required.", 401, "AUTH_REQUIRED", false);
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken.trim()}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(idempotencyKey === undefined ? {} : { "Idempotency-Key": idempotencyKey }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
    });

    const responseBody = await readJson(response);
    throwIfAborted(signal);
    const envelope = objectValue(responseBody);
    if (!response.ok || envelope?.ok === false) {
      const error = objectValue(envelope?.error);
      const status = response.status || 502;
      throw new ClinicSearchApiError(
        stringValue(error?.message) ?? `Clinic search request failed (${status}).`,
        status,
        stringValue(error?.code),
        typeof error?.retryable === "boolean" ? error.retryable : undefined,
      );
    }
    if (!envelope || envelope.ok !== true || !("data" in envelope)) {
      throw new ClinicSearchApiError("The backend returned an invalid response envelope.", response.status, "INVALID_RESPONSE", false);
    }
    return envelope.data;
  }
}

/** Explicitly call this after a user action; it triggers the browser permission prompt. */
export function getBrowserLocation(options: {
  signal?: AbortSignal;
  enableHighAccuracy?: boolean;
  timeoutMs?: number;
  maximumAgeMs?: number;
} = {}): Promise<ClinicLocation> {
  throwIfAborted(options.signal);
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("이 브라우저에서 위치를 가져올 수 없습니다. HTTPS로 접속했는지 확인해 주세요."));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      options.signal?.removeEventListener("abort", onAbort);
      callback();
    };
    const onAbort = () => finish(() => reject(abortError()));
    options.signal?.addEventListener("abort", onAbort, { once: true });

    navigator.geolocation.getCurrentPosition(
      (position) => finish(() => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
        capturedAt: new Date(position.timestamp).toISOString(),
      })),
      (error) => finish(() => reject(new Error(geolocationErrorMessage(error)))),
      {
        enableHighAccuracy: options.enableHighAccuracy ?? false,
        timeout: options.timeoutMs ?? 10_000,
        maximumAge: options.maximumAgeMs ?? 30_000,
      },
    );
  });
}

/** Create a normal user-clickable link; it never opens a popup programmatically. */
export function createNaverSearchAnchor(
  naverSearchUrl: string,
  label = "네이버 지도에서 길찾기",
  documentRef: Document = document,
): HTMLAnchorElement {
  const parsed = new URL(naverSearchUrl);
  const safeUrl = parsed.hostname === "map.naver.com" && parsed.pathname === "/index.nhn"
    ? validateNaverWalkingUrl(naverSearchUrl)
    : validateNaverSearchUrl(naverSearchUrl);
  const anchor = documentRef.createElement("a");
  anchor.href = safeUrl.toString();
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.textContent = label;
  return anchor;
}

export function validateNaverSearchUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("The clinic search URL is invalid.");
  }

  const allowedHosts = new Set(["m.search.naver.com", "search.naver.com"]);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname) || url.pathname !== "/search.naver") {
    throw new TypeError("Only HTTPS Naver search route URLs are allowed.");
  }
  if (url.username || url.password || url.port || url.hash) {
    throw new TypeError("The Naver search URL contains an unexpected authority component.");
  }

  const queryKeys = Array.from(url.searchParams.keys());
  const queries = url.searchParams.getAll("query");
  const routes = url.searchParams.getAll("nso_path");
  if (queryKeys.length !== 2 || queryKeys.some((key) => key !== "query" && key !== "nso_path") ||
      queries.length !== 1 || queries[0] !== "빠른길찾기" || routes.length !== 1 || !isNaverRoutePattern(routes[0])) {
    throw new TypeError("The Naver URL does not contain a supported clinic route request.");
  }
  return url;
}

/** Validate the verified coordinate-based NAVER Maps walking route format. */
export function validateNaverWalkingUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("The walking route URL is invalid.");
  }
  if (url.protocol !== "https:" || url.hostname !== "map.naver.com" || url.pathname !== "/index.nhn" ||
      url.username || url.password || url.port || url.hash) {
    throw new TypeError("Only the verified HTTPS NAVER Maps walking route URL is allowed.");
  }

  const requiredKeys = ["slng", "slat", "stext", "elng", "elat", "etext", "menu", "pathType", "showMap"];
  const entries = Array.from(url.searchParams.entries());
  const actualKeys = entries.map(([key]) => key);
  if (entries.length !== requiredKeys.length || new Set(actualKeys).size !== requiredKeys.length ||
      requiredKeys.some((key) => !actualKeys.includes(key))) {
    throw new TypeError("The walking route URL has missing, duplicate, or unexpected query parameters.");
  }
  const one = (key: string) => url.searchParams.getAll(key)[0];
  if (one("menu") !== "route" || one("pathType") !== "3" || one("showMap") !== "true") {
    throw new TypeError("The walking route URL does not request the verified route mode.");
  }
  if (!isKoreaCoordinate(one("slat"), 31.43, 44.35) || !isKoreaCoordinate(one("elat"), 31.43, 44.35) ||
      !isKoreaCoordinate(one("slng"), 122.37, 132) || !isKoreaCoordinate(one("elng"), 122.37, 132) ||
      !isRouteLabel(one("stext")) || !isRouteLabel(one("etext"))) {
    throw new TypeError("The walking route URL has invalid Korea coordinates or place labels.");
  }
  return url;
}

export function getClinicNavigationPrimaryLabel(navigation?: ClinicNavigation): string {
  return navigation?.selectedMode === "WALK" ? "도보 길찾기" : "대중교통 길찾기";
}

/** Create a UUID to reuse as Idempotency-Key if the same submit is retried. */
export function createClinicSearchRequestId(): string {
  if (typeof globalThis.crypto === "undefined" || typeof globalThis.crypto.randomUUID !== "function") {
    throw new Error("A secure random UUID implementation is required.");
  }
  return globalThis.crypto.randomUUID();
}

function isNaverRoutePattern(value: string): boolean {
  // Names are expected to have route delimiters sanitized by the search service.
  const coordinate = "-?\\d+(?:\\.\\d+)?";
  const origin = `placeType\\^place;name\\^[^;|^]+;address\\^;code\\^;longitude\\^${coordinate};latitude\\^${coordinate}`;
  const destination = `type\\^place;name\\^[^;|^]+;address\\^[^;|^]*;code\\^;longitude\\^${coordinate};latitude\\^${coordinate}`;
  return new RegExp(`^${origin}\\|${destination}\\|objtype\\^path;by\\^pubtrans$`).test(value);
}

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError("baseUrl must be an absolute HTTP(S) URL.");
  }
  const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !isLocalHttp) {
    throw new TypeError("baseUrl must use HTTPS, except for local development.");
  }
  if (url.search || url.hash || url.username || url.password) {
    throw new TypeError("baseUrl cannot include credentials, a query, or a fragment.");
  }
  return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
}

function validateSearchInput(input: SubmitClinicSearchInput): void {
  if (!input || typeof input.query !== "string" || !input.query.trim() || input.query.length > 300 || /[\u0000-\u001f\u007f-\u009f]/.test(input.query)) {
    throw new TypeError("query must contain 1 through 300 printable characters.");
  }
  const location = input.location;
  if (!location || !Number.isFinite(location.latitude) || location.latitude < 31.43 || location.latitude > 44.35 ||
      !Number.isFinite(location.longitude) || location.longitude < 122.37 || location.longitude > 132) {
    throw new TypeError("location must contain coordinates inside the supported Korea area.");
  }
  if (location.accuracyMeters !== undefined && (!Number.isFinite(location.accuracyMeters) || location.accuracyMeters < 0 || location.accuracyMeters > 5_000)) {
    throw new TypeError("accuracyMeters must be between 0 and 5000 meters.");
  }
  if (location.capturedAt !== undefined && (typeof location.capturedAt !== "string" || !location.capturedAt.trim() || location.capturedAt.length > 40 || !Number.isFinite(Date.parse(location.capturedAt)))) {
    throw new TypeError("capturedAt must be a valid timestamp string.");
  }
  if (input.region !== undefined && (typeof input.region !== "string" || !["SEOUL", "CHUNCHEON", "WONJU"].includes(input.region))) {
    throw new TypeError("region is not supported.");
  }
  if (input.specialtyCode !== undefined && (typeof input.specialtyCode !== "string" || !/^\d{2}$/.test(input.specialtyCode))) {
    throw new TypeError("specialtyCode must contain two digits.");
  }
  if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 5)) {
    throw new TypeError("limit must be an integer from 1 through 5.");
  }
  if (input.radiusKm !== undefined && (!Number.isFinite(input.radiusKm) || input.radiusKm < 0.1 || input.radiusKm > 50)) {
    throw new TypeError("radiusKm must be between 0.1 and 50.");
  }
  if (input.originLabel !== undefined && (typeof input.originLabel !== "string" || !input.originLabel.trim() || input.originLabel.length > 120 || /[\u0000-\u001f\u007f-\u009f]/.test(input.originLabel))) {
    throw new TypeError("originLabel must contain 1 through 120 printable characters.");
  }
}

function parseJob(value: unknown, mayContainResult: boolean): ClinicSearchJob {
  const job = objectValue(value);
  if (!job || typeof job.jobId !== "string" || typeof job.status !== "string" ||
      !["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"].includes(job.status)) {
    throw new ClinicSearchApiError("The backend returned an invalid clinic-search job.", 502, "INVALID_RESPONSE", false);
  }
  const parsed: ClinicSearchJob = {
    jobId: job.jobId,
    status: job.status as ClinicSearchJobStatus,
  };
  if (typeof job.pollAfterMs === "number" && Number.isFinite(job.pollAfterMs)) parsed.pollAfterMs = job.pollAfterMs;
  if (typeof job.expiresAt === "string") parsed.expiresAt = job.expiresAt;
  const error = objectValue(job.error);
  if (error) parsed.error = {
    code: stringValue(error.code),
    message: stringValue(error.message),
    retryable: typeof error.retryable === "boolean" ? error.retryable : undefined,
  };
  if (mayContainResult && job.result !== undefined) parsed.result = parseSearchResult(job.result);
  return parsed;
}

function parseSearchResult(value: unknown): ClinicSearchResult {
  const result = objectValue(value);
  if (!result || typeof result.answer !== "string" || typeof result.generationMode !== "string" || !Array.isArray(result.candidates)) {
    throw new ClinicSearchApiError("The backend returned an invalid clinic-search result.", 502, "INVALID_RESPONSE", false);
  }
  const parsed: ClinicSearchResult = {
    answer: result.answer,
    generationMode: result.generationMode,
    candidates: result.candidates.map(parseCandidate),
  };
  if (Array.isArray(result.citations)) parsed.citations = result.citations;
  for (const field of ["distanceType", "routeMode", "routeProvider", "routeUrlFormat", "datasetVersion", "locationNotice"] as const) {
    const value = stringValue(result[field]);
    if (value !== undefined) parsed[field] = value;
  }
  if (Array.isArray(result.coverage) && result.coverage.every((region) => typeof region === "string")) {
    parsed.coverage = result.coverage as string[];
  }
  if (typeof result.routeResultVerified === "boolean") parsed.routeResultVerified = result.routeResultVerified;
  return parsed;
}

function parseCandidate(value: unknown): ClinicCandidate {
  const candidate = objectValue(value);
  if (!candidate || typeof candidate.clinicKey !== "string" || typeof candidate.clinicName !== "string" ||
      typeof candidate.address !== "string" || !isCoordinate(candidate.latitude, -90, 90) ||
      !isCoordinate(candidate.longitude, -180, 180) ||
      !(typeof candidate.phone === "string" || candidate.phone === null) ||
      !Array.isArray(candidate.specialties) || !candidate.specialties.every(isClinicSpecialty) ||
      !((typeof candidate.distanceMeters === "number" && Number.isFinite(candidate.distanceMeters) && candidate.distanceMeters >= 0) || candidate.distanceMeters === null) ||
      typeof candidate.sourceId !== "string" || !(typeof candidate.sourceAsOf === "string" || candidate.sourceAsOf === null) ||
      typeof candidate.naverSearchUrl !== "string") {
    throw new ClinicSearchApiError("The backend returned an invalid clinic-search candidate.", 502, "INVALID_RESPONSE", false);
  }
  const navigation = candidate.navigation === undefined ? undefined : parseNavigation(candidate.navigation);
  try {
    if (navigation?.selectedMode === "WALK") validateNaverWalkingUrl(candidate.naverSearchUrl);
    else validateNaverSearchUrl(candidate.naverSearchUrl);
    if (candidate.walkingSearchUrl !== undefined) {
      if (typeof candidate.walkingSearchUrl !== "string") throw new TypeError();
      validateNaverWalkingUrl(candidate.walkingSearchUrl);
    }
  } catch {
    throw new ClinicSearchApiError("The backend returned an unsupported Naver route URL.", 502, "INVALID_RESPONSE", false);
  }
  return {
    clinicKey: candidate.clinicKey,
    clinicName: candidate.clinicName,
    address: candidate.address,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    phone: candidate.phone,
    specialties: candidate.specialties as ClinicSpecialty[],
    distanceMeters: candidate.distanceMeters,
    sourceId: candidate.sourceId,
    sourceAsOf: candidate.sourceAsOf,
    naverSearchUrl: candidate.naverSearchUrl,
    ...(typeof candidate.walkingSearchUrl === "string" ? { walkingSearchUrl: candidate.walkingSearchUrl } : {}),
    ...(navigation ? { navigation } : {}),
  };
}

function parseNavigation(value: unknown): ClinicNavigation {
  const navigation = objectValue(value);
  const selectedMode = navigation?.selectedMode;
  const availability = navigation?.availability;
  const automaticFallback = navigation?.automaticFallback;
  const expectedFallback = availability === "NOT_FOUND";
  const expectedMode = expectedFallback ? "WALK" : "TRANSIT";
  if (!navigation || typeof navigation.transitUrl !== "string" || typeof navigation.walkingUrl !== "string" ||
      !["TRANSIT", "WALK"].includes(String(selectedMode)) ||
      !["FOUND", "NOT_FOUND", "UNKNOWN"].includes(String(availability)) ||
      typeof automaticFallback !== "boolean" || selectedMode !== expectedMode || automaticFallback !== expectedFallback ||
      (navigation.checkStatus !== undefined && typeof navigation.checkStatus !== "string")) {
    throw new ClinicSearchApiError("The backend returned invalid navigation metadata.", 502, "INVALID_RESPONSE", false);
  }
  try {
    validateNaverSearchUrl(navigation.transitUrl);
    validateNaverWalkingUrl(navigation.walkingUrl);
  } catch {
    throw new ClinicSearchApiError("The backend returned an unsupported navigation URL.", 502, "INVALID_RESPONSE", false);
  }
  return {
    transitUrl: navigation.transitUrl,
    walkingUrl: navigation.walkingUrl,
    selectedMode: selectedMode as ClinicNavigation["selectedMode"],
    availability: availability as ClinicNavigation["availability"],
    automaticFallback,
    ...(typeof navigation.checkStatus === "string" ? { checkStatus: navigation.checkStatus } : {}),
  };
}

function isClinicSpecialty(value: unknown): value is ClinicSpecialty {
  const specialty = objectValue(value);
  return Boolean(specialty && typeof specialty.code === "string" && typeof specialty.name === "string" &&
    ((typeof specialty.specialistCount === "number" && Number.isFinite(specialty.specialistCount) && specialty.specialistCount >= 0) ||
      specialty.specialistCount === null));
}

function validateRequestId(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    throw new TypeError("idempotencyKey must be a lowercase canonical UUID.");
  }
}

function isCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function isKoreaCoordinate(value: string | null, minimum: number, maximum: number): boolean {
  if (!value || !/^-?\d+(?:\.\d+)?$/.test(value)) return false;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) && coordinate >= minimum && coordinate <= maximum;
}

function isRouteLabel(value: string | null): boolean {
  return Boolean(value && value.trim() && value.length <= 120 && !/[\u0000-\u001f\u007f-\u009f]/.test(value));
}

function getTerminalResult(job: ClinicSearchJob): ClinicSearchResult | undefined {
  if (job.status === "FAILED") throw new ClinicSearchJobFailedError(job.jobId, job.error);
  if (job.status !== "SUCCEEDED") return undefined;
  if (!job.result) {
    throw new ClinicSearchApiError("A completed clinic-search job has no result.", 502, "INVALID_RESPONSE", false);
  }
  return job.result;
}

function checkExpiry(job: ClinicSearchJob): void {
  if (job.expiresAt && Number.isFinite(Date.parse(job.expiresAt)) && Date.parse(job.expiresAt) <= Date.now()) {
    throw new ClinicSearchApiError("This clinic-search job has expired.", 410, "JOB_EXPIRED", false);
  }
}

function clampPollDelay(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function createDeadline(parent: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  didTimeout: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timedOut = false;
  const onParentAbort = () => controller.abort();
  if (parent?.aborted) controller.abort();
  else parent?.addEventListener("abort", onParentAbort, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onParentAbort);
    },
  };
}

function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(abortError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

async function withAbort<T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return pending;
  let onAbort: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(abortError());
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    return await Promise.race([pending, aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort!);
  }
}

function abortError(): Error {
  return new DOMException("The operation was aborted.", "AbortError");
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ClinicSearchApiError("The backend returned invalid JSON.", response.status || 502, "INVALID_RESPONSE", false);
  }
}

function geolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case 1: return "위치 권한이 거부됐습니다. 브라우저 설정에서 허용하거나 체험 위치를 선택해 주세요.";
    case 2: return "현재 위치를 확인하지 못했습니다. 기기의 위치 설정을 확인해 주세요.";
    case 3: return "위치 확인 시간이 초과됐습니다. 다시 시도해 주세요.";
    default: return "현재 위치를 가져오지 못했습니다.";
  }
}
