import { openDb, txDone } from "../db/idb.js";
import { STORES } from "../db/schema.js";
import { validateManifest } from "./package-contract.js";

const ACTIVE_SLOT = "A";

const KIND_TO_STORE = {
  suppliers: STORES.suppliers,
  locations: STORES.locations,
  articles: STORES.articles,
  stock: STORES.stock,
  sales: STORES.sales,
  aggregates: STORES.aggregates
};

function normalizeArticle(a) {
  const norm = value => String(value ?? "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");

  return {
    ...a,
    articleNumber: String(a.articleNumber ?? "").trim(),
    description: String(a.description ?? "").trim(),
    model: String(a.model ?? "").trim() || "—",
    descriptionNorm: norm(a.description),
    modelNorm: norm(a.model),
    supplierId: String(a.supplierId ?? "").trim(),
    ean: String(a.ean ?? "").trim()
  };
}

async function sha256Text(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

function parseJsonLines(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      const e = new Error(`Ungültige JSONL-Zeile ${i + 1}.`);
      e.code = "DATASET_JSONL_INVALID";
      throw e;
    }
  }
  return rows;
}

async function readSegment(file, segment) {
  const text = await file.text();

  if (segment.sha256) {
    const hash = await sha256Text(text);
    if (hash !== segment.sha256) {
      const error = new Error(`Hash-Prüfung für ${segment.file} fehlgeschlagen.`);
      error.code = "DATASET_HASH_MISMATCH";
      throw error;
    }
  }

  if (segment.format === "jsonl") return parseJsonLines(text);
  if (segment.format === "json") {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : (parsed.rows || []);
  }

  const error = new Error(`Unbekanntes Segmentformat ${segment.format}.`);
  error.code = "DATASET_FORMAT_UNSUPPORTED";
  throw error;
}

export async function importSegmentedDataset(fileMap, manifestFile, onProgress = () => {}) {
  const manifestText = await manifestFile.text();
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    const error = new Error("manifest.json ist ungültig.");
    error.code = "DATASET_MANIFEST_INVALID";
    throw error;
  }

  validateManifest(manifest);

  const missing = manifest.segments
    .filter(seg => !fileMap.has(seg.file))
    .map(seg => seg.file);

  if (missing.length) {
    const error = new Error(`Es fehlen ${missing.length} Segmentdateien.`);
    error.code = "DATASET_FILES_MISSING";
    error.detail = missing;
    throw error;
  }

  const db = await openDb();
  const staged = new Map();
  let processedSegments = 0;

  for (const segment of manifest.segments) {
    onProgress({
      stage: "validate",
      percent: Math.round((processedSegments / manifest.segments.length) * 45),
      detail: `${segment.file} wird geprüft…`
    });

    const rows = await readSegment(fileMap.get(segment.file), segment);
    const transformed = segment.kind === "articles"
      ? rows.map(normalizeArticle).filter(row => row.articleNumber)
      : rows;

    staged.set(segment.kind, transformed);
    processedSegments++;
  }

  onProgress({ stage: "write", percent: 50, detail: "Alle Segmente geprüft. Lokale Datenbank wird aktualisiert…" });

  const storeNames = Object.values(KIND_TO_STORE);
  const tx = db.transaction([...storeNames, STORES.meta], "readwrite");

  for (const storeName of storeNames) tx.objectStore(storeName).clear();

  const totalRows = [...staged.values()].reduce((sum, rows) => sum + rows.length, 0) || 1;
  let written = 0;

  for (const [kind, rows] of staged.entries()) {
    const storeName = KIND_TO_STORE[kind];
    const store = tx.objectStore(storeName);

    for (const row of rows) {
      store.put({ ...row, slot: ACTIVE_SLOT });
      written++;

      if (written % 1000 === 0) {
        onProgress({
          stage: "write",
          percent: 50 + Math.round((written / totalRows) * 48),
          detail: `${written.toLocaleString("de-DE")} / ${totalRows.toLocaleString("de-DE")} Datensätze geschrieben`
        });
        await new Promise(requestAnimationFrame);
      }
    }
  }

  const meta = tx.objectStore(STORES.meta);
  meta.put({ key: "activeSlot", value: ACTIVE_SLOT });
  meta.put({
    key: "dataset",
    value: {
      datasetVersion: manifest.datasetVersion,
      schemaVersion: manifest.schemaVersion,
      createdAt: manifest.createdAt || null,
      importedAt: new Date().toISOString(),
      source: manifest.source || "segmented",
      counts: manifest.counts || {},
      packageId: manifest.packageId || null
    }
  });

  await txDone(tx);

  onProgress({ stage: "done", percent: 100, detail: "Neuer Datenstand vollständig aktiviert." });

  return {
    datasetVersion: manifest.datasetVersion,
    counts: manifest.counts || {},
    totalRows
  };
}
