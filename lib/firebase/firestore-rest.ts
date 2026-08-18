import "server-only";

// ============================================================================
// Firestore REST client
// ----------------------------------------------------------------------------
// `firebase-admin/firestore` cannot run on Cloudflare Workers (its gRPC stack
// pulls `@grpc/proto-loader` → `protobufjs`, which is blocked from codegen:
// "Code generation from strings disallowed for this context"). This module is
// a dependency-free drop-in that speaks the Firestore REST v1 API directly and
// runs identically on Node (Vercel) and workerd (Cloudflare Workers).
//
// Supported surface (mirrors what the app actually uses):
//   - collection / doc / add / set (merge) / update / delete
//   - where (==, in, array-contains-any, ...) / orderBy / limit / offset
//   - count aggregation, batches (commit), findNearest (throws → caller falls
//     back to the keyword search leg)
//   - Timestamp + FieldValue (serverTimestamp / increment / array union-remove /
//     delete / vector)
//
// Auth: service-account JWT minted with WebCrypto (RS256) and exchanged at
// https://oauth2.googleapis.com/token — no node-only runtime dependencies.
// ============================================================================

export interface FirestoreRestOptions {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

const OAUTH_SCOPE = "https://www.googleapis.com/auth/datastore";

// ---------------------------------------------------------------------------
// Timestamp
// ---------------------------------------------------------------------------

export class Timestamp {
  constructor(
    readonly seconds: number,
    readonly nanoseconds: number,
  ) {}

  static now(): Timestamp {
    return Timestamp.fromDate(new Date());
  }

  static fromDate(date: Date): Timestamp {
    const ms = date.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1_000_000);
  }

  static fromMillis(ms: number): Timestamp {
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1_000_000);
  }

  fromDate(): Date {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1_000_000);
  }

  toDate(): Date {
    return this.fromDate();
  }

  toMillis(): number {
    return this.seconds * 1000 + this.nanoseconds / 1_000_000;
  }

  toSeconds(): number {
    return this.seconds;
  }

  toISOString(): string {
    const base = new Date(this.seconds * 1000).toISOString();
    const nanos = String(this.nanoseconds).padStart(9, "0");
    return `${base.replace(/\.\d{3}Z$/, "")}.${nanos}Z`;
  }

  isEqual(other: Timestamp): boolean {
    return this.seconds === other.seconds && this.nanoseconds === other.nanoseconds;
  }

  valueOf(): string {
    return this.toISOString();
  }

  /** Plain serializable form — required for React Flight server→client props. */
  toJSON(): { seconds: number; nanoseconds: number } {
    return { seconds: this.seconds, nanoseconds: this.nanoseconds };
  }
}

// ---------------------------------------------------------------------------
// FieldValue
// ---------------------------------------------------------------------------

const FIELD_VALUE_SENTINEL: unique symbol = Symbol("firestore-rest-field-value");

export type FieldValueKind =
  | "serverTimestamp"
  | "delete"
  | "increment"
  | "arrayUnion"
  | "arrayRemove"
  | "vector";

export class FieldValue {
  readonly [FIELD_VALUE_SENTINEL] = true;

  private constructor(
    readonly kind: FieldValueKind,
    readonly value: unknown,
  ) {}

  static serverTimestamp(): FieldValue {
    return new FieldValue("serverTimestamp", null);
  }

  static delete(): FieldValue {
    return new FieldValue("delete", null);
  }

  static increment(n: number): FieldValue {
    return new FieldValue("increment", n);
  }

  static arrayUnion(...elements: unknown[]): FieldValue {
    return new FieldValue("arrayUnion", elements);
  }

  static arrayRemove(...elements: unknown[]): FieldValue {
    return new FieldValue("arrayRemove", elements);
  }

  static vector(vector: number[]): FieldValue {
    return new FieldValue("vector", vector);
  }

  static is(value: unknown): value is FieldValue {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { [FIELD_VALUE_SENTINEL]?: boolean })[FIELD_VALUE_SENTINEL] === true
    );
  }
}

// ---------------------------------------------------------------------------
// Protobuf <-> JS value conversion
// ---------------------------------------------------------------------------

type ProtoValue = Record<string, unknown>;

function toProtoValue(value: unknown): ProtoValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (value instanceof Timestamp) return { timestampValue: value.toISOString() };
  if (value instanceof Date) return { timestampValue: value.toISOString() };

  if (FieldValue.is(value)) {
    if (value.kind === "vector") {
      return { vectorValue: { values: value.value as number[] } };
    }
    // Transforms (serverTimestamp / increment / ...) are only legal at the
    // top level of a write and are handled by `serializeDocument`.
    throw new Error(
      `FieldValue transform "${value.kind}" may only be used at the top level of a write.`,
    );
  }

  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toProtoValue) } };
  }

  if (typeof value === "object") {
    const fields: Record<string, ProtoValue> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (child === undefined) continue;
      fields[key] = toProtoValue(child);
    }
    return { mapValue: { fields } };
  }

  throw new Error(`Cannot serialize value of type "${typeof value}" to Firestore.`);
}

function fromProtoValue(value: ProtoValue | undefined): unknown {
  if (!value) return null;
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) {
    return Timestamp.fromDate(new Date(String(value.timestampValue)));
  }
  if ("referenceValue" in value) return String(value.referenceValue);
  if ("bytesValue" in value) return String(value.bytesValue);
  if ("geoPointValue" in value) return value.geoPointValue;
  if ("arrayValue" in value) {
    const inner = value.arrayValue as { values?: ProtoValue[] };
    return (inner.values ?? []).map((v) => fromProtoValue(v));
  }
  if ("mapValue" in value) {
    const inner = value.mapValue as { fields?: Record<string, ProtoValue> };
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(inner.fields ?? {})) {
      out[key] = fromProtoValue(child);
    }
    return out;
  }
  if ("vectorValue" in value) {
    const inner = value.vectorValue as { values?: number[] };
    return inner.values ?? [];
  }
  return null;
}

interface SerializedDocument {
  fields: Record<string, ProtoValue>;
  fieldPaths: string[];
  transforms: FieldTransform[];
}

interface FieldTransform {
  fieldPath: string;
  setToServerValue?: "REQUEST_TIME";
  increment?: { integerValue?: string; doubleValue?: number };
  appendMissingElements?: { values: ProtoValue[] };
  removeAllFromArray?: { values: ProtoValue[] };
}

/** Splits a write payload into REST `fields` + `updateMask` paths + `updateTransforms`. */
function serializeDocument(data: object): SerializedDocument {
  const fields: Record<string, ProtoValue> = {};
  const fieldPaths: string[] = [];
  const transforms: FieldTransform[] = [];

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (value === undefined) continue;
    fieldPaths.push(key);

    if (FieldValue.is(value)) {
      switch (value.kind) {
        case "serverTimestamp":
          transforms.push({ fieldPath: key, setToServerValue: "REQUEST_TIME" });
          continue;
        case "increment": {
          const n = value.value as number;
          transforms.push({
            fieldPath: key,
            increment: Number.isSafeInteger(n)
              ? { integerValue: String(n) }
              : { doubleValue: n },
          });
          continue;
        }
        case "arrayUnion":
          transforms.push({
            fieldPath: key,
            appendMissingElements: { values: (value.value as unknown[]).map(toProtoValue) },
          });
          continue;
        case "arrayRemove":
          transforms.push({
            fieldPath: key,
            removeAllFromArray: { values: (value.value as unknown[]).map(toProtoValue) },
          });
          continue;
        case "delete":
          // Listed in the mask but omitted from `fields` → the server removes it.
          continue;
        case "vector":
          fields[key] = toProtoValue(value);
          continue;
      }
    }

    fields[key] = toProtoValue(value);
  }

  return { fields, fieldPaths, transforms };
}

// ---------------------------------------------------------------------------
// JWT minting (WebCrypto RS256) + OAuth token exchange
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expiresAt: number } | null = null;

function base64UrlBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(`-----BEGIN`) && !line.startsWith(`-----END`))
    .join("");
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function signRsaSha256(privateKeyPem: string, data: string): Promise<string> {
  const isPkcs8 = /-----BEGIN PRIVATE KEY-----/.test(privateKeyPem);
  if (!isPkcs8) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON private key must be in PKCS#8 PEM format (BEGIN PRIVATE KEY).",
    );
  }
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToDer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(data),
  );
  return base64UrlBytes(new Uint8Array(signature));
}

function encodeJwtPart(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return base64UrlBytes(bytes);
}

async function getAccessToken(creds: FirestoreRestOptions): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: creds.clientEmail,
    scope: OAUTH_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signingInput = `${encodeJwtPart(JSON.stringify(header))}.${encodeJwtPart(JSON.stringify(claims))}`;
  const signature = await signRsaSha256(creds.privateKey, signingInput);
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Firestore REST auth failed (${res.status}): ${await safeErrorBody(res)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  const ttl = (json.expires_in ?? 3600) - 60;
  cachedToken = { token: json.access_token, expiresAt: Date.now() + ttl * 1000 };
  return cachedToken.token;
}

async function safeErrorBody(res: Response): Promise<string> {
  try {
    const raw: unknown = await res.json();
    const error = Array.isArray(raw) ? raw[0] : raw;
    const msg = (error as { error?: { message?: string } })?.error?.message;
    if (msg) return msg;
    return typeof raw === "object" && raw !== null && "status" in raw
      ? JSON.stringify(raw)
      : res.statusText;
  } catch {
    return res.statusText;
  }
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

/** Matches firebase-admin's `DocumentData` loosely-typed map. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DocumentData = { [field: string]: any };

export interface QueryOptions {
  merge?: boolean;
}

export class DocumentSnapshot {
  readonly id: string;
  readonly ref: DocumentReference;
  readonly exists: boolean;
  private readonly _fields: Record<string, ProtoValue> | null;

  constructor(db: FirestoreRest, document: { name: string; fields?: Record<string, ProtoValue> }) {
    const rel = relativeDocPath(document.name);
    const lastSlash = rel.lastIndexOf("/");
    this.id = rel.slice(lastSlash + 1);
    this.exists = Boolean(document.fields);
    this._fields = document.fields ?? null;
    this.ref = new DocumentReference(db, rel);
  }

  data(): DocumentData {
    if (!this.exists || !this._fields) return {};
    const out: DocumentData = {};
    for (const [key, value] of Object.entries(this._fields)) {
      out[key] = fromProtoValue(value);
    }
    return out;
  }
}

export class QuerySnapshot {
  readonly docs: DocumentSnapshot[];

  constructor(readonly db: FirestoreRest, docs: DocumentSnapshot[]) {
    this.docs = docs;
  }

  get empty(): boolean {
    return this.docs.length === 0;
  }

  get size(): number {
    return this.docs.length;
  }

  forEach(callback: (doc: DocumentSnapshot) => void): void {
    this.docs.forEach(callback);
  }
}

export class CountResult {
  private readonly count: number;

  constructor(count: number) {
    this.count = count;
  }

  data(): { count: number } {
    return { count: this.count };
  }
}

// ---------------------------------------------------------------------------
// References / queries
// ---------------------------------------------------------------------------

interface WhereClause {
  fieldPath: string;
  operator: string;
  value: ProtoValue;
}

interface OrderByClause {
  fieldPath: string;
  direction: "ASCENDING" | "DESCENDING";
}

interface QuerySpec {
  collectionId: string;
  parent: string;
  where: WhereClause[];
  orderBy: OrderByClause[];
  limit: number | null;
  offset: number | null;
  vector?: Record<string, unknown>;
}

const OP_MAP: Record<string, string> = {
  "==": "EQUAL",
  "!=": "NOT_EQUAL",
  "<": "LESS_THAN",
  "<=": "LESS_THAN_OR_EQUAL",
  ">": "GREATER_THAN",
  ">=": "GREATER_THAN_OR_EQUAL",
  in: "IN",
  "not-in": "NOT_IN",
  "array-contains": "ARRAY_CONTAINS",
  "array-contains-any": "ARRAY_CONTAINS_ANY",
};

export class Query {
  protected readonly spec: QuerySpec;

  constructor(
    protected readonly db: FirestoreRest,
    spec: QuerySpec,
  ) {
    this.spec = spec;
  }

  where(fieldPath: string, operator: string, value: unknown): Query {
    const mapped = OP_MAP[operator];
    if (!mapped) throw new Error(`Unsupported Firestore filter operator "${operator}".`);
    return new Query(this.db, {
      ...this.spec,
      where: [...this.spec.where, { fieldPath, operator: mapped, value: toProtoValue(value) }],
    });
  }

  orderBy(fieldPath: string, direction?: "asc" | "desc"): Query {
    return new Query(this.db, {
      ...this.spec,
      orderBy: [
        ...this.spec.orderBy,
        { fieldPath, direction: direction === "desc" ? "DESCENDING" : "ASCENDING" },
      ],
    });
  }

  limit(n: number): Query {
    return new Query(this.db, { ...this.spec, limit: n });
  }

  offset(n: number): Query {
    return new Query(this.db, { ...this.spec, offset: n });
  }

  count(): CountQuery {
    return new CountQuery(this.db, this.spec.parent, this.structuredQuery());
  }

  /**
   * Native vector search is not exposed by the Firestore REST API. Returns a
   * query whose `get()` always throws, so callers (vector-search.ts) catch it
   * and transparently fall back to the keyword search leg.
   */
  findNearest(options: Record<string, unknown>): Query {
    return new Query(this.db, { ...this.spec, vector: options });
  }

  async get(): Promise<QuerySnapshot> {
    if (this.spec.vector) {
      throw new Error(
        "Firestore findNearest is not supported over the REST API on Cloudflare Workers; falling back to keyword search.",
      );
    }
    const parent = this.db.rootUrl(this.spec.parent);
    const url = `${parent}:runQuery`;
    const res = await this.db.request(url, {
      method: "POST",
      body: JSON.stringify({ structuredQuery: this.structuredQuery() }),
    });
    if (!res.ok) {
      throw new Error(`Firestore query failed (${res.status}): ${await safeErrorBody(res)}`);
    }
    const json = (await res.json()) as Array<{
      document?: { name: string; fields?: Record<string, ProtoValue> };
      done?: boolean;
    }>;
    const docs: DocumentSnapshot[] = [];
    for (const entry of json) {
      if (entry.done) break;
      if (entry.document) docs.push(new DocumentSnapshot(this.db, entry.document));
    }
    return new QuerySnapshot(this.db, docs);
  }

  private structuredQuery(): Record<string, unknown> {
    const query: Record<string, unknown> = {
      from: [{ collectionId: this.spec.collectionId }],
    };
    if (this.spec.where.length > 0) {
      const filters = this.spec.where.map((w) => ({
        fieldFilter: { field: { fieldPath: w.fieldPath }, op: w.operator, value: w.value },
      }));
      query.where =
        filters.length === 1
          ? filters[0]
          : { compositeFilter: { op: "AND", filters } };
    }
    if (this.spec.orderBy.length > 0) {
      query.orderBy = this.spec.orderBy.map((o) => ({
        field: { fieldPath: o.fieldPath },
        direction: o.direction,
      }));
    }
    if (this.spec.offset != null) query.offset = this.spec.offset;
    if (this.spec.limit != null) query.limit = this.spec.limit;
    return query;
  }
}

export class CountQuery {
  constructor(
    private readonly db: FirestoreRest,
    private readonly parent: string,
    private readonly structuredQuery: Record<string, unknown>,
  ) {}

  async get(): Promise<CountResult> {
    const parent = this.db.rootUrl(this.parent);
    const url = `${parent}:runAggregationQuery`;
    const res = await this.db.request(url, {
      method: "POST",
      body: JSON.stringify({
        structuredAggregationQuery: {
          structuredQuery: this.structuredQuery,
          aggregations: [{ alias: "count", count: {} }],
        },
      }),
    });
    const json = (await res.json()) as {
      result?: Array<{ aggregateFields?: Record<string, { integerValue?: string; doubleValue?: number }> }>;
    };
    const aggregate = json.result?.[0]?.aggregateFields?.count;
    const count = aggregate?.integerValue != null ? Number(aggregate.integerValue) : Number(aggregate?.doubleValue ?? 0);
    return new CountResult(Number.isFinite(count) ? count : 0);
  }
}

export class DocumentReference {
  /** Root-relative document path, e.g. "devices/{id}" or "devices/{id}/variants/{vId}". */
  readonly path: string;
  readonly id: string;

  constructor(
    private readonly db: FirestoreRest,
    path: string,
  ) {
    this.path = path;
    this.id = path.slice(path.lastIndexOf("/") + 1);
  }

  get parent(): CollectionReference {
    const segments = this.path.split("/");
    const collectionId = segments[segments.length - 2] ?? "";
    const parentPath = segments.slice(0, -2).join("/");
    return new CollectionReference(this.db, collectionId, parentPath);
  }

  collection(id: string): CollectionReference {
    return new CollectionReference(this.db, id, this.path);
  }

  async get(): Promise<DocumentSnapshot> {
    const res = await this.db.request(this.db.rootUrl(this.path), { method: "GET" });
    if (res.status === 404) {
      return new DocumentSnapshot(this.db, { name: this.path, fields: undefined });
    }
    if (!res.ok) {
      throw new Error(`Firestore document read failed (${res.status}): ${await safeErrorBody(res)}`);
    }
    const json = (await res.json()) as { name: string; fields?: Record<string, ProtoValue> };
    return new DocumentSnapshot(this.db, json);
  }

  async set(data: object, options?: QueryOptions): Promise<void> {
    const serialized = serializeDocument(data);
    const body: Record<string, unknown> = { fields: serialized.fields };
    if (options?.merge || serialized.transforms.length > 0) {
      body.updateMask = { fieldPaths: serialized.fieldPaths };
    }
    if (serialized.transforms.length > 0) {
      body.updateTransforms = serialized.transforms;
    }
    const res = await this.db.request(this.db.rootUrl(this.path), {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Firestore write failed (${res.status}): ${await safeErrorBody(res)}`);
    }
  }

  async update(data: object): Promise<void> {
    const serialized = serializeDocument(data);
    const body: Record<string, unknown> = {
      currentDocument: { exists: true },
      fields: serialized.fields,
      updateMask: { fieldPaths: serialized.fieldPaths },
    };
    if (serialized.transforms.length > 0) {
      body.updateTransforms = serialized.transforms;
    }
    const res = await this.db.request(this.db.rootUrl(this.path), {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Firestore update failed (${res.status}): ${await safeErrorBody(res)}`);
    }
  }

  async delete(): Promise<void> {
    const res = await this.db.request(this.db.rootUrl(this.path), { method: "DELETE" });
    if (!res.ok && res.status !== 404) {
      throw new Error(`Firestore delete failed (${res.status}): ${await safeErrorBody(res)}`);
    }
  }
}

export class CollectionReference extends Query {
  readonly id: string;
  /** Relative path above this collection ("" for top-level), e.g. "devices/{id}". */
  readonly parent: string;
  readonly path: string;

  constructor(db: FirestoreRest, id: string, parent: string) {
    super(db, { collectionId: id, parent, where: [], orderBy: [], limit: null, offset: null });
    this.id = id;
    this.parent = parent;
    this.path = parent ? `${parent}/${id}` : id;
  }

  doc(documentId?: string): DocumentReference {
    const id = documentId ?? newAutoId();
    return new DocumentReference(this.db, `${this.path}/${id}`);
  }

  async add(data: object): Promise<DocumentReference> {
    const ref = this.doc();
    await ref.set(data);
    return ref;
  }

  // `where` / `orderBy` / `limit` / `offset` inherited from Query must return
  // a Query rooted at this collection (parent preserved via this.spec.parent).
}

export class WriteBatch {
  private readonly writes: Array<Record<string, unknown>> = [];

  constructor(private readonly db: FirestoreRest) {}

  private docName(ref: DocumentReference): string {
    return `${this.db.root}/${ref.path}`;
  }

  set(ref: DocumentReference, data: object, options?: QueryOptions): WriteBatch {
    const serialized = serializeDocument(data);
    const update: Record<string, unknown> = { name: this.docName(ref), fields: serialized.fields };
    if (options?.merge || serialized.transforms.length > 0) {
      update.updateMask = { fieldPaths: serialized.fieldPaths };
    }
    const write: Record<string, unknown> = { update };
    if (serialized.transforms.length > 0) {
      write.updateTransforms = serialized.transforms;
    }
    this.writes.push(write);
    return this;
  }

  update(ref: DocumentReference, data: object): WriteBatch {
    const serialized = serializeDocument(data);
    const write: Record<string, unknown> = {
      update: {
        name: this.docName(ref),
        fields: serialized.fields,
        updateMask: { fieldPaths: serialized.fieldPaths },
        currentDocument: { exists: true },
      },
    };
    if (serialized.transforms.length > 0) {
      write.updateTransforms = serialized.transforms;
    }
    this.writes.push(write);
    return this;
  }

  delete(ref: DocumentReference): WriteBatch {
    this.writes.push({ delete: this.docName(ref) });
    return this;
  }

  async commit(): Promise<void> {
    const url = this.db.rootUrl(":commit");
    const res = await this.db.request(url, {
      method: "POST",
      body: JSON.stringify({ writes: this.writes }),
    });
    if (!res.ok) {
      throw new Error(`Firestore batch commit failed (${res.status}): ${await safeErrorBody(res)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Client root
// ---------------------------------------------------------------------------

function newAutoId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

/** Strips the database root from a server-returned document name. */
function relativeDocPath(name: string): string {
  const marker = "/documents/";
  const idx = name.lastIndexOf(marker);
  return idx >= 0 ? name.slice(idx + marker.length) : name;
}

export class FirestoreRest {
  readonly projectId: string;
  readonly root: string;

  constructor(private readonly opts: FirestoreRestOptions) {
    this.projectId = opts.projectId;
    this.root = `https://firestore.googleapis.com/v1/projects/${opts.projectId}/databases/(default)/documents`;
  }

  collection(id: string): CollectionReference {
    return new CollectionReference(this, id, "");
  }

  batch(): WriteBatch {
    return new WriteBatch(this);
  }

  /** Builds an encoded request URL from a root-relative path ("devices/{id}" / ":commit"). */
  rootUrl(relativePath: string): string {
    if (relativePath.startsWith(":")) return `${this.root}${relativePath}`;
    if (!relativePath) return this.root;
    const encoded = relativePath.split("/").map(encodeURIComponent).join("/");
    return `${this.root}/${encoded}`;
  }

  async request(url: string, init: RequestInit): Promise<Response> {
    const token = await getAccessToken(this.opts);
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (res.status >= 500) {
      throw new Error(`Firestore REST error (${res.status}): ${await safeErrorBody(res)}`);
    }
    return res;
  }
}
