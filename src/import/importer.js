import { openDb, txDone, getActiveSlot, purgeSlot } from "../db/idb.js";
import { STORES } from "../db/schema.js";

const CHUNK_SIZE = 2000;
const SUPPORTED_SCHEMA = 2;

function workerChunk(type, rows) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./import-worker.js", import.meta.url), { type: "module" });
    worker.onmessage = event => {
      worker.terminate();
      if (event.data?.ok) resolve(event.data.normalized);
      else reject(new Error(event.data?.error || "Import fehlgeschlagen."));
    };
    worker.onerror = error => {
      worker.terminate();
      reject(error);
    };
    worker.postMessage({ type, rows });
  });
}

async function sha256(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

function validate(payload) {
  if (!payload || payload.schemaVersion !== SUPPORTED_SCHEMA) {
    throw new Error(`Datenformat nicht unterstützt. Erwartet: schemaVersion ${SUPPORTED_SCHEMA}.`);
  }
  for (const key of ["articles", "suppliers", "locations"]) {
    if (!Array.isArray(payload[key])) throw new Error(`Pflichtbereich '${key}' fehlt.`);
  }
}

function buildAggregates(payload) {
  const supplied = Array.isArray(payload.aggregates) ? payload.aggregates : [];
  if (supplied.length) return supplied;

  let stockValue = 0;
  for (const row of payload.stock || []) {
    const qty = Number(row.quantity || 0);
    const purchasePrice = Number(row.purchasePrice || 0);
    stockValue += qty * purchasePrice;
  }

  return [{
    key: "dashboard",
    articleCount: payload.articles.length,
    supplierCount: payload.suppliers.length,
    locationCount: payload.locations.length,
    stockValue,
    generatedAt: new Date().toISOString()
  }];
}

async function writeChunk(storeName, slot, rows) {
  const db = await openDb();
  const tx = db.transaction(storeName, "readwrite");
  const store = tx.objectStore(storeName);
  for (const row of rows) store.put({ ...row, slot });
  await txDone(tx);
}

async function importGroup(type, storeName, rows, slot, progress) {
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    const normalized = await workerChunk(type, chunk);
    await writeChunk(storeName, slot, normalized);
    progress(normalized.length);
    await new Promise(requestAnimationFrame);
  }
}

async function activate(slot, manifest) {
  const db = await openDb();
  const tx = db.transaction(STORES.meta, "readwrite");
  const store = tx.objectStore(STORES.meta);
  store.put({ key: "dataset", value: manifest });
  store.put({ key: "activeSlot", value: slot });
  await txDone(tx);
}

export async function importDatasetFile(file, onProgress = () => {}) {
  if (!file) throw new Error("Keine Datei ausgewählt.");
  if (file.size > 350 * 1024 * 1024) {
    throw new Error("Das Datenpaket ist größer als 350 MB. Für iPhone/iPad bitte künftig das segmentierte Paketformat verwenden.");
  }

  const fileHash = await sha256(file);
  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error("Die Datei ist kein gültiges JSON-Datenpaket.");
  }
  validate(payload);

  const oldSlot = await getActiveSlot();
  const newSlot = oldSlot === "A" ? "B" : "A";
  await purgeSlot(newSlot);

  const aggregates = buildAggregates(payload);
  const groups = [
    ["articles", STORES.articles, payload.articles],
    ["suppliers", STORES.suppliers, payload.suppliers],
    ["locations", STORES.locations, payload.locations],
    ["stock", STORES.stock, payload.stock || []],
    ["sales", STORES.sales, payload.sales || []],
    ["aggregates", STORES.aggregates, aggregates]
  ];

  const total = groups.reduce((sum, [, , rows]) => sum + rows.length, 0) || 1;
  let done = 0;
  const progress = count => {
    done += count;
    onProgress(Math.min(99, Math.round((done / total) * 100)));
  };

  try {
    for (const [type, store, rows] of groups) {
      await importGroup(type, store, rows, newSlot, progress);
    }

    const manifest = {
      ...(payload.manifest || {}),
      schemaVersion: SUPPORTED_SCHEMA,
      fileName: file.name,
      fileSize: file.size,
      sha256: fileHash,
      importedAt: new Date().toISOString(),
      counts: {
        articles: payload.articles.length,
        suppliers: payload.suppliers.length,
        locations: payload.locations.length,
        stock: (payload.stock || []).length,
        sales: (payload.sales || []).length
      }
    };

    await activate(newSlot, manifest);
    onProgress(100);

    if (oldSlot && oldSlot !== newSlot) purgeSlot(oldSlot).catch(console.error);
    return manifest;
  } catch (error) {
    await purgeSlot(newSlot).catch(console.error);
    throw error;
  }
}
