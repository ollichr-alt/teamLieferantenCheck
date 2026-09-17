import { getAllFromStores, getOne, openDb, txDone } from "../db/idb.js";
import { STORES } from "../db/schema.js";

const WORKSPACE_SCHEMA_VERSION = 3;
const WORKSPACE_STORES = [STORES.workspace, STORES.preferences];

async function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function exportWorkspace() {
  const stores = await getAllFromStores(WORKSPACE_STORES);
  const dataset = (await getOne(STORES.meta, "dataset"))?.value || null;

  const body = {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    type: "team-lieferantencheck-workspace",
    appCoreVersion: "0.5.0",
    exportedAt: new Date().toISOString(),
    datasetReference: dataset ? {
      datasetVersion: dataset.datasetVersion || null,
      hash: dataset.hash || null,
      importedAt: dataset.importedAt || null
    } : null,
    workspaceMeta: {
      workspaceId: crypto.randomUUID(),
      revision: Date.now(),
      deviceId: localStorage.getItem("lc-device-id") || null
    },
    stores
  };

  const canonical = JSON.stringify(body);
  const integrity = await sha256(canonical);

  const payload = {
    ...body,
    integrity: { algorithm: "SHA-256", value: integrity }
  };

  return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
}

export async function inspectWorkspaceFile(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    throw Object.assign(new Error("Arbeitsstand ist kein gültiges JSON."), { code: "WORKSPACE_JSON_INVALID" });
  }

  if (payload?.type !== "team-lieferantencheck-workspace") {
    if (payload?.schemaVersion === 1 && Array.isArray(payload.workspace)) {
      return {
        payload: {
          schemaVersion: 1,
          type: "legacy-workspace",
          stores: { [STORES.workspace]: payload.workspace, [STORES.preferences]: [] },
          datasetReference: null,
          exportedAt: payload.exportedAt || null
        },
        legacy: true,
        warnings: ["Arbeitsstand stammt aus Mobile Core 0.1/0.2 und wird migriert."]
      };
    }
    throw Object.assign(new Error("Datei ist kein LieferantenCheck-Arbeitsstand."), { code: "WORKSPACE_TYPE_INVALID" });
  }

  if (![2, WORKSPACE_SCHEMA_VERSION].includes(payload.schemaVersion)) {
    throw Object.assign(
      new Error(`Arbeitsstand-Version ${payload.schemaVersion} wird nicht unterstützt.`),
      { code: "WORKSPACE_SCHEMA_UNSUPPORTED" }
    );
  }

  if (!payload.stores || !Array.isArray(payload.stores[STORES.workspace])) {
    throw Object.assign(new Error("Arbeitsstand enthält keine gültigen Workspace-Daten."), { code: "WORKSPACE_CONTENT_INVALID" });
  }

  const { integrity, ...body } = payload;
  const expected = await sha256(JSON.stringify(body));
  if (!integrity?.value || integrity.value !== expected) {
    throw Object.assign(new Error("Integritätsprüfung des Arbeitsstands fehlgeschlagen."), { code: "WORKSPACE_INTEGRITY_FAILED" });
  }

  return { payload, legacy: false, warnings: [] };
}

export async function importWorkspaceFile(file) {
  const inspected = await inspectWorkspaceFile(file);
  const payload = inspected.payload;

  const db = await openDb();
  const tx = db.transaction(WORKSPACE_STORES, "readwrite");

  for (const name of WORKSPACE_STORES) {
    const store = tx.objectStore(name);
    store.clear();
    for (const row of payload.stores?.[name] || []) store.put(row);
  }

  await txDone(tx);
  return {
    importedAt: new Date().toISOString(),
    exportedAt: payload.exportedAt || null,
    datasetReference: payload.datasetReference || null,
    legacy: inspected.legacy,
    warnings: inspected.warnings
  };
}
