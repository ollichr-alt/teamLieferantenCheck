import { getOne, putOne } from "../db/idb.js";
import { STORES } from "../db/schema.js";

export const FILE_TYPES = {
  dataset: {
    description: "LieferantenCheck Datenpaket",
    accept: { "application/json": [".lcdata", ".json"] }
  },
  workspace: {
    description: "LieferantenCheck Arbeitsstand",
    accept: { "application/json": [".lcworkspace", ".json"] }
  }
};

export async function pickFile(kind) {
  const type = FILE_TYPES[kind];
  if (!type) throw Object.assign(new Error("Unbekannter Dateityp."), { code: "EXCHANGE_KIND_UNKNOWN" });

  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: type.description, accept: type.accept }]
    });
    return await handle.getFile();
  }
  return null;
}

export async function saveFile(file, title = "LieferantenCheck Export") {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
    return { method: "share" };
  }

  const url = URL.createObjectURL(file);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  return { method: "download" };
}

export async function rememberExchange(kind, file) {
  await putOne(STORES.preferences, {
    key: `lastExchange:${kind}`,
    value: {
      name: file?.name || "—",
      size: file?.size || 0,
      lastModified: file?.lastModified || null,
      at: new Date().toISOString()
    }
  });
}

export async function getLastExchange(kind) {
  return (await getOne(STORES.preferences, `lastExchange:${kind}`))?.value || null;
}

export function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export async function pickDatasetFolder() {
  if (!window.showDirectoryPicker) return null;

  const handle = await window.showDirectoryPicker({ mode: "read" });
  const fileMap = new Map();

  for await (const [name, child] of handle.entries()) {
    if (child.kind !== "file") continue;
    fileMap.set(name, await child.getFile());
  }

  const manifestFile = fileMap.get("manifest.json");
  if (!manifestFile) {
    const error = new Error("manifest.json wurde im ausgewählten Ordner nicht gefunden.");
    error.code = "DATASET_MANIFEST_MISSING";
    throw error;
  }

  return { fileMap, manifestFile, folderName: handle.name };
}

export async function buildFileMapFromSelection(fileList) {
  const fileMap = new Map();
  for (const file of Array.from(fileList || [])) {
    const name = file.webkitRelativePath
      ? file.webkitRelativePath.split("/").pop()
      : file.name;
    fileMap.set(name, file);
  }

  const manifestFile = fileMap.get("manifest.json");
  if (!manifestFile) {
    const error = new Error("manifest.json fehlt in der Auswahl.");
    error.code = "DATASET_MANIFEST_MISSING";
    throw error;
  }

  return { fileMap, manifestFile };
}
