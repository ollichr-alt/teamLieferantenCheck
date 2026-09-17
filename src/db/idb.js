import { DB_NAME, DB_VERSION, STORES, DATA_STORES } from "./schema.js";

function recreate(db, name, options, indexes = []) {
  if (db.objectStoreNames.contains(name)) db.deleteObjectStore(name);
  const store = db.createObjectStore(name, options);
  for (const index of indexes) store.createIndex(index.name, index.keyPath, index.options || {});
  return store;
}

export function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.workspace)) {
        db.createObjectStore(STORES.workspace, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORES.preferences)) {
        db.createObjectStore(STORES.preferences, { keyPath: "key" });
      }

      if (oldVersion < 2) {
        recreate(db, STORES.articles, { keyPath: ["slot", "articleNumber"] }, [
          { name: "slot", keyPath: "slot" },
          { name: "slotSupplier", keyPath: ["slot", "supplierId"] },
          { name: "searchKeys", keyPath: "searchKeys", options: { multiEntry: true } }
        ]);
        recreate(db, STORES.suppliers, { keyPath: ["slot", "supplierId"] }, [
          { name: "slot", keyPath: "slot" }
        ]);
        recreate(db, STORES.locations, { keyPath: ["slot", "locationId"] }, [
          { name: "slot", keyPath: "slot" }
        ]);
        recreate(db, STORES.stock, { keyPath: ["slot", "locationId", "articleNumber"] }, [
          { name: "slot", keyPath: "slot" },
          { name: "slotArticle", keyPath: ["slot", "articleNumber"] },
          { name: "slotLocation", keyPath: ["slot", "locationId"] }
        ]);
        recreate(db, STORES.sales, { keyPath: ["slot", "period", "locationId", "articleNumber"] }, [
          { name: "slot", keyPath: "slot" },
          { name: "slotArticle", keyPath: ["slot", "articleNumber"] },
          { name: "slotLocation", keyPath: ["slot", "locationId"] }
        ]);
        recreate(db, STORES.aggregates, { keyPath: ["slot", "key"] }, [
          { name: "slot", keyPath: "slot" }
        ]);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getOne(storeName, key) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  const req = tx.objectStore(storeName).get(key);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getAll(storeName) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readonly");
  const req = tx.objectStore(storeName).getAll();
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function getActiveSlot() {
  return (await getOne(STORES.meta, "activeSlot"))?.value || null;
}

export async function purgeSlot(slot) {
  if (!slot) return;
  const db = await openDb();
  const tx = db.transaction(DATA_STORES, "readwrite");

  for (const storeName of DATA_STORES) {
    const store = tx.objectStore(storeName);
    const index = store.index("slot");
    const range = IDBKeyRange.only(slot);
    const req = index.openKeyCursor(range);
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      store.delete(cursor.primaryKey);
      cursor.continue();
    };
  }

  await txDone(tx);
}

export async function putOne(storeName, value) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(value);
  await txDone(tx);
}

export async function getAllFromStores(storeNames) {
  const db = await openDb();
  const tx = db.transaction(storeNames, "readonly");
  const out = {};
  await Promise.all(storeNames.map(name => new Promise((resolve, reject) => {
    const req = tx.objectStore(name).getAll();
    req.onsuccess = () => { out[name] = req.result ?? []; resolve(); };
    req.onerror = () => reject(req.error);
  })));
  return out;
}
