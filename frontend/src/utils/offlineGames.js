import { api } from './api';

const DB_NAME = 'le-qg-offline';
const DB_VERSION = 1;
const SESSION_STORE = 'solo_sessions';
const OUTBOX_STORE = 'result_outbox';
const SYNC_TAG = 'le-qg-offline-results';
let databasePromise;
let activeFlush;

function openDatabase() {
  if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB indisponible'));
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SESSION_STORE)) {
        const sessions = database.createObjectStore(SESSION_STORE, { keyPath: 'id' });
        sessions.createIndex('gameId', 'gameId', { unique: false });
        sessions.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!database.objectStoreNames.contains(OUTBOX_STORE)) {
        const outbox = database.createObjectStore(OUTBOX_STORE, { keyPath: 'idempotencyKey' });
        outbox.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });

  return databasePromise;
}

async function runStore(storeName, mode, operation) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request;
    try {
      request = operation(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error || request?.error);
    transaction.onabort = () => reject(transaction.error || new Error('Transaction annulee'));
  });
}

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export async function saveSoloSession(session) {
  if (!session?.id || !session?.gameId) throw new Error('Une session solo doit avoir un id et un gameId');
  const record = { ...session, updatedAt: new Date().toISOString() };
  await runStore(SESSION_STORE, 'readwrite', (store) => store.put(record));
  return record;
}

export function loadSoloSession(id) {
  return runStore(SESSION_STORE, 'readonly', (store) => store.get(id));
}

export function deleteSoloSession(id) {
  return runStore(SESSION_STORE, 'readwrite', (store) => store.delete(id));
}

export function listSoloSessions() {
  return runStore(SESSION_STORE, 'readonly', (store) => store.getAll());
}

async function requestBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    if ('sync' in registration) await registration.sync.register(SYNC_TAG);
  } catch {
    // The online listener remains the fallback when Background Sync is unavailable.
  }
}

export async function queueSoloResult({ gameId, result, completedAt = new Date().toISOString() }) {
  if (!gameId || !result) throw new Error('Un resultat solo doit avoir un gameId et un contenu');
  const entry = {
    idempotencyKey: createId(),
    gameId,
    result,
    completedAt,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
  await runStore(OUTBOX_STORE, 'readwrite', (store) => store.add(entry));
  await requestBackgroundSync();
  window.dispatchEvent(new CustomEvent('offline_result_queued', { detail: entry }));
  return entry;
}

export function listPendingResults() {
  return runStore(OUTBOX_STORE, 'readonly', (store) => store.getAll());
}

async function markAttempt(entry) {
  return runStore(OUTBOX_STORE, 'readwrite', (store) => store.put({
    ...entry,
    attempts: Number(entry.attempts || 0) + 1,
    lastAttemptAt: new Date().toISOString(),
  }));
}

export async function flushSoloResults() {
  if (!navigator.onLine) return { synced: 0, pending: (await listPendingResults()).length };
  if (activeFlush) return activeFlush;

  activeFlush = (async () => {
    const entries = (await listPendingResults()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    let synced = 0;

    for (const entry of entries) {
      try {
        await api.post('/solo/results/sync', {
          idempotency_key: entry.idempotencyKey,
          game_id: entry.gameId,
          completed_at: entry.completedAt,
          result: entry.result,
        }, {
          headers: { 'X-Idempotency-Key': entry.idempotencyKey },
        });
        await runStore(OUTBOX_STORE, 'readwrite', (store) => store.delete(entry.idempotencyKey));
        synced += 1;
      } catch {
        await markAttempt(entry);
        break;
      }
    }

    const pending = (await listPendingResults()).length;
    if (synced > 0) window.dispatchEvent(new CustomEvent('offline_results_synced', { detail: { synced, pending } }));
    return { synced, pending };
  })();

  try {
    return await activeFlush;
  } finally {
    activeFlush = null;
  }
}

export function startOfflineSync() {
  const sync = () => flushSoloResults().catch(() => {});
  window.addEventListener('online', sync);
  window.addEventListener('offline_sync_requested', sync);
  if (navigator.onLine) sync();
  return () => {
    window.removeEventListener('online', sync);
    window.removeEventListener('offline_sync_requested', sync);
  };
}
