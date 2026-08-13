import type { Deck, GameConfig, GameHistoryEntry, GameSession } from '../domain/types'

const DB_NAME = 'palavra-30s'
const DB_VERSION = 2
const SESSIONS = 'sessions'
const HISTORY = 'history'
const DECKS = 'custom-decks'
const PREFERENCES = 'preferences'
const ACTIVE_KEY = 'active'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SESSIONS)) db.createObjectStore(SESSIONS)
      if (!db.objectStoreNames.contains(HISTORY)) db.createObjectStore(HISTORY, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(DECKS)) db.createObjectStore(DECKS, { keyPath: 'id' })
      if (!db.objectStoreNames.contains(PREFERENCES)) db.createObjectStore(PREFERENCES)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function put(storeName: string, value: unknown, key?: IDBValidKey): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    key === undefined ? store.put(value) : store.put(value, key)
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}

async function get<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly')
    const request = transaction.objectStore(storeName).get(key)
    request.onsuccess = () => { db.close(); resolve(request.result ?? null) }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction(storeName, 'readonly').objectStore(storeName).getAll()
    request.onsuccess = () => { db.close(); resolve(request.result ?? []) }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}

async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite')
    transaction.objectStore(storeName).delete(key)
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}

export const saveSession = (session: GameSession) => put(SESSIONS, session, ACTIVE_KEY)
export const loadSession = () => get<GameSession>(SESSIONS, ACTIVE_KEY)
export const clearSession = () => remove(SESSIONS, ACTIVE_KEY)

export const saveHistoryEntry = (entry: GameHistoryEntry) => put(HISTORY, entry)
export async function loadHistory(): Promise<GameHistoryEntry[]> {
  return (await getAll<GameHistoryEntry>(HISTORY)).sort((a, b) => b.completedAt - a.completedAt)
}

export const saveCustomDeck = (deck: Deck) => put(DECKS, deck)
export const loadCustomDecks = () => getAll<Deck>(DECKS)
export const deleteCustomDeck = (id: string) => remove(DECKS, id)

export const savePreferences = (config: GameConfig) => put(PREFERENCES, config, 'game-config')
export const loadPreferences = () => get<GameConfig>(PREFERENCES, 'game-config')
