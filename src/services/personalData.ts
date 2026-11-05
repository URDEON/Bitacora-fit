/** Personal modules are independent of the existing Fit database and its backups. */
export const PERSONAL_STORAGE_KEY = 'bitacora_personal_v1';
export const MAX_PERSONAL_TIMESTAMP = 8_640_000_000_000_000 - 1_000_000;
export interface PersonalTransaction {
  id: string;
  kind: 'income' | 'expense';
  amount: number; // CLP, whole pesos. Never floating point money.
  category: string;
  description: string;
  date: string;
  time: string;
  createdAt: number;
  updatedAt: number;
}
export interface PersonalNote {
  id: string;
  title: string;
  body: string;
  favorite: boolean;
  kind: 'note' | 'task';
  tasks: { id: string; text: string; done: boolean }[];
  createdAt: number;
  updatedAt: number;
}
export interface PersonalData {
  version: 1;
  updatedAt: number;
  transactions: PersonalTransaction[];
  notes: PersonalNote[];
  deleted: { transactions: Record<string, number>; notes: Record<string, number> };
}
export const emptyPersonalData = (): PersonalData => ({ version: 1, updatedAt: 0, transactions: [], notes: [], deleted: { transactions: {}, notes: {} } });
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function fail(): never { throw new Error('El archivo de Finanzas y Notas no es válido. Tus datos actuales se conservan.'); }
function text(value: unknown, max: number, required = true): asserts value is string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail();
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) fail();
}
function safeKeys(value: unknown, depth = 0) {
  if (depth > 12) fail();
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) fail();
    safeKeys(child, depth + 1);
  }
}
function list(value: unknown, max = 10000): asserts value is unknown[] { if (!Array.isArray(value) || value.length > max) fail(); }
function identity(item: Record<string, unknown>, seen: Set<string>) {
  text(item.id, 100); if (['__proto__', 'prototype', 'constructor'].includes(item.id) || seen.has(item.id)) fail(); seen.add(item.id);
  integer(item.createdAt, 0, MAX_PERSONAL_TIMESTAMP); integer(item.updatedAt, 0, MAX_PERSONAL_TIMESTAMP);
  if (item.updatedAt < item.createdAt) fail();
}
export function validatePersonalData(value: unknown): PersonalData {
  if (!object(value) || value.version !== 1) fail();
  safeKeys(value); integer(value.updatedAt, 0, MAX_PERSONAL_TIMESTAMP);
  list(value.transactions); list(value.notes, 5000);
  const transactions: PersonalTransaction[] = [];
  const seenTransactions = new Set<string>();
  for (const item of value.transactions) {
    if (!object(item)) fail(); identity(item, seenTransactions);
    if ((item.updatedAt as number) > value.updatedAt) fail();
    if (item.kind !== 'income' && item.kind !== 'expense') fail();
    integer(item.amount, 1, 10_000_000_000);
    text(item.category, 60); text(item.description, 300, false);
    text(item.date, 10); text(item.time, 5);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(Date.parse(item.date + 'T12:00:00Z')) || new Date(item.date + 'T12:00:00Z').toISOString().slice(0, 10) !== item.date) fail();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time)) fail();
    transactions.push({ id: item.id as string, kind: item.kind, amount: item.amount, category: item.category, description: item.description, date: item.date, time: item.time, createdAt: item.createdAt as number, updatedAt: item.updatedAt as number });
  }
  const notes: PersonalNote[] = [];
  const seenNotes = new Set<string>();
  for (const item of value.notes) {
    if (!object(item)) fail(); identity(item, seenNotes);
    if ((item.updatedAt as number) > value.updatedAt) fail();
    text(item.title, 200); text(item.body, 20000, false);
    if (typeof item.favorite !== 'boolean' || (item.kind !== 'note' && item.kind !== 'task')) fail();
    list(item.tasks, 500); const taskIds = new Set<string>();
    const tasks = item.tasks.map(task => {
      if (!object(task)) fail(); text(task.id, 100); text(task.text, 1000);
      if (['__proto__', 'prototype', 'constructor'].includes(task.id) || taskIds.has(task.id) || typeof task.done !== 'boolean') fail(); taskIds.add(task.id);
      return { id: task.id, text: task.text, done: task.done };
    });
    notes.push({ id: item.id as string, title: item.title, body: item.body, favorite: item.favorite, kind: item.kind, tasks, createdAt: item.createdAt as number, updatedAt: item.updatedAt as number });
  }
  const deleted: PersonalData['deleted'] = { transactions: {}, notes: {} };
  if (value.deleted !== undefined) {
    if (!object(value.deleted)) fail();
    for (const kind of ['transactions', 'notes'] as const) {
      const entries = value.deleted[kind];
      if (!object(entries) || Object.keys(entries).length > 20000) fail();
      for (const [id, timestamp] of Object.entries(entries)) { text(id, 100); integer(timestamp, 0, MAX_PERSONAL_TIMESTAMP); if (timestamp > value.updatedAt) fail(); deleted[kind][id] = timestamp; }
    }
  }
  return { version: 1, updatedAt: value.updatedAt, transactions, notes, deleted };
}

/** Last edit wins per record; deletion timestamps stop old tabs/backups resurrecting records. */
export function mergePersonalData(left: PersonalData, right: PersonalData): PersonalData {
  const deleted: PersonalData['deleted'] = { transactions: {}, notes: {} };
  for (const kind of ['transactions', 'notes'] as const) {
    for (const [id, time] of [...Object.entries(left.deleted[kind]), ...Object.entries(right.deleted[kind])].sort(([a], [b]) => a.localeCompare(b))) deleted[kind][id] = Math.max(deleted[kind][id] || 0, time);
  }
  function merge<T extends { id: string; updatedAt: number }>(a: T[], b: T[], removed: Record<string, number>): T[] {
    const entries = new Map(a.map(item => [item.id, item]));
    for (const item of b) { const old = entries.get(item.id); if (!old || item.updatedAt > old.updatedAt || (item.updatedAt === old.updatedAt && JSON.stringify(item) > JSON.stringify(old))) entries.set(item.id, item); }
    return [...entries.values()].filter(item => (removed[item.id] ?? -1) < item.updatedAt).sort((a, b) => a.id.localeCompare(b.id));
  }
  return validatePersonalData({ version: 1, updatedAt: Math.max(left.updatedAt, right.updatedAt), deleted,
    transactions: merge(left.transactions, right.transactions, deleted.transactions), notes: merge(left.notes, right.notes, deleted.notes) });
}

export function commitPersonalUpdate(previous: PersonalData, next: PersonalData, now = Date.now()): PersonalData {
  const timestamp = Math.max(now, previous.updatedAt + 1);
  const deleted: PersonalData['deleted'] = { transactions: {}, notes: {} };
  for (const kind of ['transactions', 'notes'] as const) {
    for (const [id, time] of [...Object.entries(previous.deleted[kind]), ...Object.entries(next.deleted[kind])].sort(([a], [b]) => a.localeCompare(b))) deleted[kind][id] = Math.max(deleted[kind][id] ?? 0, time);
  }
  for (const kind of ['transactions', 'notes'] as const) {
    const retained = new Set(next[kind].map(item => item.id));
    for (const item of previous[kind]) if (!retained.has(item.id)) deleted[kind][item.id] = timestamp;
  }
  return validatePersonalData({ ...next, version: 1, updatedAt: timestamp, deleted });
}

export function parsePersonalBackup(json: string): PersonalData {
  if (json.length > 15 * 1024 * 1024) fail();
  let value: unknown; try { value = JSON.parse(json); } catch { fail(); }
  if (!object(value) || value.format !== 'bitacora-personal' || value.version !== 1) fail();
  return validatePersonalData(value.data);
}
export function personalBackupJSON(data: PersonalData): string {
  return JSON.stringify({ format: 'bitacora-personal', version: 1, exportedAt: new Date().toISOString(), data: validatePersonalData(data) }, null, 2);
}
export function personalSummary(data: PersonalData, month: string) {
  const allIncome = data.transactions.filter(t => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);
  const allExpense = data.transactions.filter(t => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const transactions = data.transactions.filter(t => t.date.startsWith(month + '-')).sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time) || b.createdAt - a.createdAt);
  const income = transactions.filter(t => t.kind === 'income').reduce((sum, t) => sum + t.amount, 0);
  const expense = transactions.filter(t => t.kind === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const categories = new Map<string, number>();
  for (const item of transactions) if (item.kind === 'expense') categories.set(item.category, (categories.get(item.category) ?? 0) + item.amount);
  return { balance: allIncome - allExpense, income, expense, transactions, categories: [...categories].sort((a, b) => b[1] - a[1]) };
}
