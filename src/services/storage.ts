import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { BitacoraDB, PersistedChronoState } from '../types';
import { DEFAULT_ROUTINES } from '../data/defaultRoutines';
import { validateDB } from './dbValidation';
import { STORED_PHOTO_PATTERN, validateImageFile } from './imageValidation';

const STORAGE_KEY_V5 = 'bitacora_fit_s20fe_v5';
const LEGACY_KEY_V4 = 'bitacora_fit_s20fe_v4';
const NATIVE_FILE_NAME = 'bitacora_fit_v5_db.json';
const SNAPSHOT_KEY = 'bitacora_fit_v5_undo_snapshot';

const IDB_NAME = 'BitacoraFitProDB';
const IDB_STORE = 'app_state';
const IDB_RECORD_KEY = 'primary_db';

export const DEFAULT_CHRONO_STATE: PersistedChronoState = {
  mode: 'countdown',
  running: false,
  startedAtEpochMs: null,
  accumulatedElapsedMs: 0,
  initialSelectedMs: 90000,
  laps: [],
  hiitWorkSec: 40,
  hiitRestSec: 20,
  hiitTotalRounds: 8,
  hiitCurrentRound: 1,
  hiitPhase: 'work',
  autoStartOnSet: false,
  keepScreenAwake: false,
};

export function createEmptyDB(): BitacoraDB {
  return {
    version: 5,
    updatedAt: 0,
    darkMode: true,
    alarmType: 'bell',
    goals: {
      calories: 2200,
      proteinG: 140,
      waterMl: 2500,
      targetWeightKg: 75,
      weeklyWorkoutDays: 4,
    },
    workouts: [],
    meals: [],
    waterLogs: [],
    bodyMetrics: [],
    routines: structuredClone(DEFAULT_ROUTINES),
    customCatalog: {},
    customExercisePhotos: {},
    customFoods: [],
    favoriteExercises: [],
    savedMeals: [],
    activeSession: null,
    workoutSessions: [],
    chrono: { ...DEFAULT_CHRONO_STATE },
  };
}

export function normalizeDB(raw: Partial<BitacoraDB> | null | undefined): BitacoraDB {
  const base = createEmptyDB();
  if (!raw) return base;
  validateDB(raw);
  return {
    ...base,
    ...raw,
    version: 5,
    updatedAt: raw.updatedAt ?? 0,
    goals: { ...base.goals, ...raw.goals },
    routines: raw.routines === undefined ? base.routines : raw.routines,
    favoriteExercises: [...new Set(raw.favoriteExercises || [])],
    savedMeals: raw.savedMeals || [],
    activeSession: raw.activeSession || null,
    workoutSessions: raw.workoutSessions || [],
    chrono: { ...DEFAULT_CHRONO_STATE, ...raw.chrono },
  };
}

const readProblems: string[] = [];

// ============================================================================
// IndexedDB Layer
// ============================================================================
function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onblocked = () => reject(new Error('La base local está bloqueada por otra ventana.'));
    req.onerror = () => reject(req.error);
  });
}

async function readIDB(): Promise<BitacoraDB | null> {
  try {
    const db = await openIDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_RECORD_KEY);
      req.onsuccess = () => {
        try { resolve(req.result ? normalizeDB(req.result) : null); }
        catch (err) { reject(err); }
      };
      tx.oncomplete = () => db.close();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    readProblems.push(`IndexedDB: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function writeIDB(data: BitacoraDB): Promise<void> {
  const db = await openIDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(data, IDB_RECORD_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Guardado local interrumpido.'));
    });
  } finally { db.close(); }
}

// ============================================================================
// Native Android Filesystem + Preferences Layer
// ============================================================================
async function readNativeDB(): Promise<BitacoraDB | null> {
  if (!Capacitor.isNativePlatform()) return null;
  const candidates: BitacoraDB[] = [];
  try {
    const res = await Filesystem.readFile({ path: NATIVE_FILE_NAME, directory: Directory.Data, encoding: Encoding.UTF8 });
    if (typeof res.data === 'string' && res.data) { try { candidates.push(normalizeDB(JSON.parse(res.data))); } catch(err) { readProblems.push(`Archivo nativo inválido: ${String(err)}`); } }
  } catch { /* Preferences can recover an interrupted file write. */ }
  try {
    const pref = await Preferences.get({ key: STORAGE_KEY_V5 });
    if (pref.value) { try { candidates.push(normalizeDB(JSON.parse(pref.value))); } catch(err) { readProblems.push(`Preferencias inválidas: ${String(err)}`); } }
  } catch { /* Browser and IndexedDB copies are also considered. */ }
  return candidates.sort((a,b) => b.updatedAt - a.updatedAt)[0] || null;
}

async function writeNativeDB(data: BitacoraDB): Promise<void> {
  if (!Capacitor.isNativePlatform()) throw new Error('Almacenamiento nativo no disponible.');
  const serialized = JSON.stringify(data);
  // A temporary file plus rename prevents truncating the last complete snapshot.
  const results = await Promise.allSettled([
    (async () => {
      await Filesystem.writeFile({ path: `${NATIVE_FILE_NAME}.tmp`, data: serialized, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true });
      await Filesystem.rename({ from: `${NATIVE_FILE_NAME}.tmp`, to: NATIVE_FILE_NAME, directory: Directory.Data, toDirectory: Directory.Data });
    })(),
    Preferences.set({ key: STORAGE_KEY_V5, value: serialized }),
  ]);
  if (results.every(r => r.status === 'rejected')) throw new Error('No se pudo guardar en el almacenamiento del teléfono.');
}

export function loadSyncFallback(): BitacoraDB {
  for (const key of [STORAGE_KEY_V5, LEGACY_KEY_V4]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return normalizeDB(JSON.parse(raw));
    } catch (err) { readProblems.push(`Copia local: ${err instanceof Error ? err.message : String(err)}`); }
  }
  return createEmptyDB();
}

/** Newer empty snapshots are intentional deletions, never replaced with older records. */
export function selectLatestSnapshot(candidates: (BitacoraDB | null)[]): BitacoraDB {
  return candidates.filter((x): x is BitacoraDB => x !== null).sort((a,b) => b.updatedAt - a.updatedAt)[0] || createEmptyDB();
}

export async function initializePersistentStorage(): Promise<BitacoraDB> {
  readProblems.length = 0;
  try { if (typeof navigator !== 'undefined') await navigator.storage?.persist?.(); } catch { /* Best effort quota request. */ }
  const localCandidate = loadSyncFallback();
  const [idbCandidate, nativeCandidate] = await Promise.all([readIDB(), readNativeDB()]);
  const winner = selectLatestSnapshot([localCandidate, idbCandidate, nativeCandidate]);
  // Do not overwrite unreadable records with a newly created empty database.
  const hasData = winner.updatedAt > 0 || winner.workouts.length || winner.meals.length || winner.waterLogs.length || winner.bodyMetrics.length;
  if (!hasData && readProblems.some(p => /valor inválido|JSON|Unexpected|position|token/i.test(p))) {
    throw new Error('No se pudo leer la copia local. Los datos originales se han conservado. Restaura un respaldo JSON desde Ajustes.');
  }
  // Existing stores are synchronized on the next user change; loading itself never overwrites data.
  lastTimestamp = Math.max(lastTimestamp, winner.updatedAt);
  return winner;
}

let writeQueuePromise: Promise<void> = Promise.resolve();
let lastTimestamp = 0;

export async function persistDB(db: BitacoraDB, bumpTimestamp = true): Promise<BitacoraDB> {
  validateDB(db);
  const timestamp = bumpTimestamp ? Math.max(Date.now(), lastTimestamp + 1, db.updatedAt + 1) : db.updatedAt;
  lastTimestamp = Math.max(lastTimestamp, timestamp);
  // Freeze the snapshot before queuing: later edits must not mutate an in-flight write.
  const next = structuredClone({ ...db, updatedAt: timestamp });
  let localSaved = false;
  try { localStorage.setItem(STORAGE_KEY_V5, JSON.stringify(next)); localSaved = true; } catch { /* Keep full data in other stores. */ }
  const save = writeQueuePromise.catch(() => {}).then(async () => {
    const results = await Promise.allSettled([writeIDB(next), writeNativeDB(next)]);
    if (!localSaved && results.every(r => r.status === 'rejected')) {
      throw new Error('No se pudieron guardar los cambios. Libera espacio y exporta un respaldo antes de cerrar la aplicación.');
    }
  });
  writeQueuePromise = save;
  await save;
  return next;
}

export function saveUndoSnapshot(db: BitacoraDB): boolean {
  try {
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(db));
    return true;
  } catch {
    return false;
  }
}

export function loadUndoSnapshot(): BitacoraDB | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? normalizeDB(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function parseBackupJSON(jsonText: string): BitacoraDB {
  if (jsonText.length > 50 * 1024 * 1024) throw new Error('El respaldo supera el límite de 50 MB.');
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText); } catch { throw new Error('El archivo no contiene JSON válido.'); }
  validateDB(parsed);
  const db = normalizeDB(parsed);
  // Duplicate identifiers inside one file are ambiguous: reject instead of dropping records.
  for (const key of ['workouts','meals','waterLogs','bodyMetrics','routines','customFoods','savedMeals','workoutSessions'] as const) {
    if (new Set(db[key].map(x=>x.id)).size !== db[key].length) throw new Error(`El respaldo tiene identificadores repetidos en «${key}».`);
  }
  return db;
}

function stableContent<T extends { id: number | string }>(item: T): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k,v])=>k !== 'id' && v !== undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));
    return value;
  };
  return JSON.stringify(canonical(item));
}

export function mergeDatabases(current: BitacoraDB, incoming: BitacoraDB): BitacoraDB {
  const dedupe = <T extends { id: number | string }>(a: T[], b: T[], onId?: (source: T, targetId: number | string) => void): T[] => {
    const result = structuredClone(a);
    const ids = new Set(result.map(x=>x.id));
    const byId = new Map(result.map(x=>[x.id,x]));
    const contents = new Map(result.map(x=>[stableContent(x),x.id]));
    const maxId = a.concat(b).reduce((max,x)=>typeof x.id === 'number' ? Math.max(max,x.id) : max,0);
    let nextId = maxId < Number.MAX_SAFE_INTEGER - 400001 ? maxId + 1 : 1;
    let stringSuffix=1;
    for (const item of b) {
      const fingerprint = stableContent(item);
      let id = item.id;
      if (ids.has(id)) {
        if(stableContent(byId.get(id)!)===fingerprint) {onId?.(item,id);continue;}
        if(contents.has(fingerprint)) {onId?.(item,contents.get(fingerprint)!);continue;}
        id = typeof id === 'number' ? nextId++ : `${String(item.id).slice(0,160)}-importado-${stringSuffix++}`;
        while(ids.has(id)) id = typeof id === 'number' ? nextId++ : `${String(item.id).slice(0,160)}-importado-${stringSuffix++}`;
      }
      onId?.(item,id); result.push(structuredClone({ ...item, id })); ids.add(id); byId.set(id,{...item,id}); contents.set(fingerprint,id);
    }
    return result;
  };
  const mergeRecord = (a: Record<string,string[]>, b: Record<string,string[]>) => {
    const result = structuredClone(a);
    for (const [key,values] of Object.entries(b)) result[key] = [...new Set([...(result[key] || []), ...values])];
    return result;
  };
  // Session names are remapped deterministically before exercises, so imports remain idempotent.
  const sessionShape = (s: NonNullable<BitacoraDB['activeSession']>) => stableContent({...s,completedIds:[]});
  const knownSessions = [...current.workoutSessions,...(current.activeSession ? [current.activeSession] : [])];
  const incomingSessions = [...incoming.workoutSessions,...(incoming.activeSession ? [incoming.activeSession] : [])];
  const sessionIds = new Map<string,string>();
  for(const session of incomingSessions) {
    const shape=sessionShape(session),existing=knownSessions.find(s=>s.id===session.id);
    let id=session.id;
    if(existing && sessionShape(existing)!==shape) {
      let hash=2166136261;for(const char of shape) {hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619);}
      const prefix=`${session.id.slice(0,160)}-import-${(hash>>>0).toString(36)}`;id=prefix;
      let suffix=1;while(knownSessions.some(s=>s.id===id && sessionShape(s)!==shape)) id=`${prefix}-${suffix++}`;
    }
    sessionIds.set(session.id,id);
  }
  const workoutIds=new Map<number,number>();
  const workouts=dedupe(current.workouts,incoming.workouts.map(w=>({...w,...(w.sessionId ? {sessionId:sessionIds.get(w.sessionId) || w.sessionId} : {})})),(source,id)=>workoutIds.set(source.id,Number(id)));
  const remapSession=(s:NonNullable<BitacoraDB['activeSession']>)=>({...s,id:sessionIds.get(s.id)||s.id,completedIds:[...new Set(s.completedIds.map(id=>workoutIds.get(id)??id))]});
  const workoutSessions=structuredClone(current.workoutSessions);
  let activeSession=current.activeSession ? structuredClone(current.activeSession) : null;
  const addSession=(s:NonNullable<BitacoraDB['activeSession']>,isActive=false)=>{
    const mapped=remapSession(s);
    if(activeSession?.id===mapped.id) {activeSession.completedIds=[...new Set([...activeSession.completedIds,...mapped.completedIds])];return;}
    const existing=workoutSessions.find(x=>x.id===mapped.id);
    if(existing) {existing.completedIds=[...new Set([...existing.completedIds,...mapped.completedIds])];return;}
    if(isActive && !activeSession) activeSession=mapped;
    else workoutSessions.push(mapped);
  };
  incoming.workoutSessions.forEach(s=>addSession(s));
  if(incoming.activeSession) addSession(incoming.activeSession,true);
  return normalizeDB({
    ...current,
    workouts, meals: dedupe(current.meals,incoming.meals),
    waterLogs: dedupe(current.waterLogs,incoming.waterLogs), bodyMetrics: dedupe(current.bodyMetrics,incoming.bodyMetrics),
    routines: dedupe(current.routines,incoming.routines), customFoods: dedupe(current.customFoods,incoming.customFoods),
    savedMeals: dedupe(current.savedMeals,incoming.savedMeals), workoutSessions,
    favoriteExercises: [...new Set([...current.favoriteExercises,...incoming.favoriteExercises])],
    customCatalog: mergeRecord(current.customCatalog,incoming.customCatalog), customExercisePhotos: mergeRecord(current.customExercisePhotos,incoming.customExercisePhotos),
    activeSession,
    updatedAt: Date.now(),
  });
}

/**
 * Compresses a user-selected camera/gallery photo into a crisp lightweight DataURL (~45KB)
 * so custom gym machine photos load instantly and persist locally offline.
 */
export async function compressImageFileToDataUrl(file: File, maxWidth = 680): Promise<string> {
  await validateImageFile(file);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen no soportado.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo procesar la imagen en este dispositivo.'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const webp = canvas.toDataURL('image/webp', 0.76);
        const output = webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/jpeg', 0.78);
        if (!STORED_PHOTO_PATTERN.test(output)) {
          reject(new Error('No se pudo convertir la imagen a un formato guardable.'));
          return;
        }
        resolve(output);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
