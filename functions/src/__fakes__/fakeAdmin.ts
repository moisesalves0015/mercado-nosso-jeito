/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Minimal in-memory fake of firebase-admin used ONLY by tests.
 * Models the subset of Firestore used by the callables: collection/doc/get/set/update/add,
 * FieldValue.serverTimestamp/increment, Timestamp.now and serialized runTransaction
 * (equivalent to the outcome of Firestore's optimistic-concurrency retries).
 */

type Data = Record<string, any>;

export class FakeTimestamp {
  constructor(private readonly ms: number) {}
  toDate(): Date {
    return new Date(this.ms);
  }
  toMillis(): number {
    return this.ms;
  }
  static now(): FakeTimestamp {
    return new FakeTimestamp(Date.now());
  }
  static fromDate(d: Date): FakeTimestamp {
    return new FakeTimestamp(d.getTime());
  }
  static fromMillis(ms: number): FakeTimestamp {
    return new FakeTimestamp(ms);
  }
}

const SERVER_TS = { __sentinel: 'serverTimestamp' };
const incrementOf = (n: number) => ({ __sentinel: 'increment', n });

function clone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof FakeTimestamp || value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(clone) as unknown as T;
  const out: Data = {};
  for (const [k, v] of Object.entries(value as Data)) {
    if (v !== undefined) out[k] = clone(v);
  }
  return out as T;
}

function resolve(current: unknown, incoming: unknown): unknown {
  if (incoming && typeof incoming === 'object' && '__sentinel' in (incoming as Data)) {
    const s = incoming as Data;
    if (s.__sentinel === 'serverTimestamp') return FakeTimestamp.now();
    if (s.__sentinel === 'increment') return (Number(current) || 0) + Number(s.n);
  }
  return clone(incoming);
}

export class FakeFirestore {
  private store = new Map<string, Data>();
  private counter = 0;
  private lock: Promise<unknown> = Promise.resolve();
  /** Every committed write, in order — lets tests assert "exactly once". */
  public commits: Array<{ op: 'set' | 'update'; path: string }> = [];

  reset(): void {
    this.store.clear();
    this.counter = 0;
    this.commits = [];
    this.lock = Promise.resolve();
    fakeAuth.reset();
  }

  autoId(): string {
    this.counter += 1;
    return `auto${String(this.counter).padStart(6, '0')}`;
  }

  seed(path: string, data: Data): void {
    this.store.set(path, clone(data));
  }

  read(path: string): Data | undefined {
    const d = this.store.get(path);
    return d ? clone(d) : undefined;
  }

  listPaths(prefix: string): string[] {
    return Array.from(this.store.keys()).filter((p) => p.startsWith(prefix));
  }

  snap(path: string) {
    const d = this.store.get(path);
    return {
      exists: d !== undefined,
      id: path.split('/').pop() as string,
      data: () => (d ? clone(d) : undefined),
    };
  }

  doSet(path: string, data: Data): void {
    const out: Data = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) out[k] = resolve(undefined, v);
    }
    this.store.set(path, out);
    this.commits.push({ op: 'set', path });
  }

  doUpdate(path: string, patch: Data): void {
    const current = this.store.get(path);
    if (!current) throw new Error(`NOT_FOUND: ${path}`);
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) current[k] = resolve(current[k], v);
    }
    this.commits.push({ op: 'update', path });
  }

  collection(path: string): FakeCollection {
    return new FakeCollection(this, path);
  }

  runTransaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
      const writes: Array<() => void> = [];
      const tx = {
        get: async (ref: FakeDocRef | FakeQuery) =>
          ref instanceof FakeQuery ? ref.get() : this.snap((ref as FakeDocRef).path),
        set: (ref: FakeDocRef, data: Data) => {
          writes.push(() => this.doSet(ref.path, data));
        },
        update: (ref: FakeDocRef, patch: Data) => {
          writes.push(() => this.doUpdate(ref.path, patch));
        },
      };
      const result = await fn(tx);
      // Commit only if the callback did not throw (rollback otherwise).
      writes.forEach((w) => w());
      return result;
    };
    const next = this.lock.then(run, run);
    this.lock = next.catch(() => undefined);
    return next;
  }
  /** Direct children documents of a collection path (no nested subcollections). */
  childDocs(collectionPath: string): Array<{ id: string; path: string; data: Data }> {
    const prefix = `${collectionPath}/`;
    const out: Array<{ id: string; path: string; data: Data }> = [];
    for (const [path, data] of this.store.entries()) {
      if (path.startsWith(prefix) && !path.slice(prefix.length).includes('/')) {
        out.push({ id: path.slice(prefix.length), path, data: clone(data) });
      }
    }
    return out;
  }
}

const orderValue = (v: unknown): number => {
  if (v instanceof FakeTimestamp) return v.toMillis();
  if (v instanceof Date) return v.getTime();
  return Number(v);
};

export class FakeQuery {
  constructor(
    private readonly db: FakeFirestore,
    private readonly collectionPath: string,
    private readonly filters: Array<[string, unknown]> = [],
    private readonly order: { field: string; dir: 'asc' | 'desc' } | null = null,
    private readonly cursor: unknown = undefined,
    private readonly max: number | null = null,
  ) {}
  where(field: string, _op: '==', value: unknown): FakeQuery {
    return new FakeQuery(this.db, this.collectionPath, [...this.filters, [field, value]], this.order, this.cursor, this.max);
  }
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(this.db, this.collectionPath, this.filters, { field, dir }, this.cursor, this.max);
  }
  startAfter(value: unknown): FakeQuery {
    return new FakeQuery(this.db, this.collectionPath, this.filters, this.order, value, this.max);
  }
  limit(n: number): FakeQuery {
    return new FakeQuery(this.db, this.collectionPath, this.filters, this.order, this.cursor, n);
  }
  async get() {
    let docs = this.db
      .childDocs(this.collectionPath)
      .filter((d) => this.filters.every(([f, v]) => d.data[f] === v));
    if (this.order) {
      const { field, dir } = this.order;
      docs.sort((a, b) => (dir === 'desc' ? -1 : 1) * (orderValue(a.data[field]) - orderValue(b.data[field])));
      if (this.cursor !== undefined) {
        const c = orderValue(this.cursor);
        docs = docs.filter((d) => (dir === 'desc' ? orderValue(d.data[field]) < c : orderValue(d.data[field]) > c));
      }
    }
    if (this.max !== null) docs = docs.slice(0, this.max);
    const snaps = docs.map((d) => ({ id: d.id, exists: true, data: () => clone(d.data) }));
    return { docs: snaps, empty: snaps.length === 0, size: snaps.length };
  }
}

export class FakeCollection {
  constructor(private readonly db: FakeFirestore, readonly path: string) {}
  doc(id?: string): FakeDocRef {
    return new FakeDocRef(this.db, `${this.path}/${id ?? this.db.autoId()}`);
  }
  async add(data: Data): Promise<FakeDocRef> {
    const ref = this.doc();
    this.db.doSet(ref.path, data);
    return ref;
  }
  where(field: string, op: '==', value: unknown): FakeQuery {
    return new FakeQuery(this.db, this.path).where(field, op, value);
  }
  orderBy(field: string, dir: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(this.db, this.path).orderBy(field, dir);
  }
  limit(n: number): FakeQuery {
    return new FakeQuery(this.db, this.path).limit(n);
  }
  get() {
    return new FakeQuery(this.db, this.path).get();
  }
}

export class FakeDocRef {
  constructor(private readonly db: FakeFirestore, readonly path: string) {}
  get id(): string {
    return this.path.split('/').pop() as string;
  }
  collection(name: string): FakeCollection {
    return new FakeCollection(this.db, `${this.path}/${name}`);
  }
  async get() {
    return this.db.snap(this.path);
  }
  async set(data: Data, options?: { merge?: boolean }) {
    if (options?.merge) {
      const current = this.db.read(this.path) || {};
      this.db.doSet(this.path, { ...current, ...data });
    } else {
      this.db.doSet(this.path, data);
    }
  }
  async update(patch: Data) {
    this.db.doUpdate(this.path, patch);
  }
}

export const fakeDb = new FakeFirestore();

/** In-memory Firebase Auth: seeded users, custom claims and a revocation log. */
class FakeAuthStore {
  users = new Map<string, { uid: string; email?: string; customClaims: Data }>();
  revoked: string[] = [];
  reset(): void {
    this.users.clear();
    this.revoked = [];
  }
  seedUser(uid: string, email?: string, customClaims: Data = {}): void {
    this.users.set(uid, { uid, email, customClaims: clone(customClaims) });
  }
  claimsOf(uid: string): Data {
    return clone(this.users.get(uid)?.customClaims ?? {});
  }
}
export const fakeAuth = new FakeAuthStore();

/** Shape consumed by `import * as admin from 'firebase-admin'` in index.ts. */
export function buildAdminMock() {
  const firestore: any = () => fakeDb;
  firestore.FieldValue = { serverTimestamp: () => SERVER_TS, increment: incrementOf };
  firestore.Timestamp = FakeTimestamp;
  return {
    initializeApp: () => undefined,
    firestore,
    auth: () => ({
      setCustomUserClaims: async (uid: string, claims: Data) => {
        const u = fakeAuth.users.get(uid) ?? { uid, customClaims: {} };
        u.customClaims = clone(claims);
        fakeAuth.users.set(uid, u);
      },
      updateUser: async () => undefined,
      revokeRefreshTokens: async (uid: string) => {
        fakeAuth.revoked.push(uid);
      },
      getUser: async (uid: string) => {
        const u = fakeAuth.users.get(uid);
        if (!u) throw Object.assign(new Error('auth/user-not-found'), { code: 'auth/user-not-found' });
        return { uid: u.uid, email: u.email, customClaims: clone(u.customClaims) };
      },
      getUserByEmail: async (email: string) => {
        const u = Array.from(fakeAuth.users.values()).find((x) => x.email === email);
        if (!u) throw Object.assign(new Error('auth/user-not-found'), { code: 'auth/user-not-found' });
        return { uid: u.uid, email: u.email, customClaims: clone(u.customClaims) };
      },
    }),
  };
}
