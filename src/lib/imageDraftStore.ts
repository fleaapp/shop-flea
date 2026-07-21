/**
 * IndexedDB-backed store for in-progress listing photos so that photos the user
 * has already added/cropped survive the app being backgrounded and reloaded.
 *
 * Blobs are stored under a caller-supplied key (e.g. per user, per draft) so
 * multiple drafts don't collide. Falls back silently if IndexedDB isn't
 * available (private mode, ancient browsers) — callers must handle empty
 * results as "no draft".
 */

const DB_NAME = 'flea-drafts';
const DB_VERSION = 1;
const STORE = 'images';

const dbSupported = () => typeof indexedDB !== 'undefined';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, cb: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  if (!dbSupported()) return undefined;
  try {
    const db = await openDB();
    return await new Promise<T | undefined>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = cb(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[imageDraftStore] IndexedDB unavailable:', err);
    return undefined;
  }
}

export interface DraftImageRecord {
  blob: Blob;
  filename: string;
  type: string;
}

export async function saveDraftImages(key: string, records: DraftImageRecord[]): Promise<void> {
  await run('readwrite', (s) => s.put(records, key));
}

export async function loadDraftImages(key: string): Promise<DraftImageRecord[]> {
  const result = await run<DraftImageRecord[]>('readonly', (s) => s.get(key));
  return Array.isArray(result) ? result : [];
}

export async function clearDraftImages(key: string): Promise<void> {
  await run('readwrite', (s) => s.delete(key));
}
