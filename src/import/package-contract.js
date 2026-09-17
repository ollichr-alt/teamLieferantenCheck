export const PACKAGE_SCHEMA_VERSION = 1;

export const REQUIRED_SEGMENTS = [
  "suppliers",
  "locations",
  "articles",
  "stock",
  "sales",
  "aggregates"
];

export function validateManifest(manifest) {
  if (!manifest || manifest.type !== "team-lieferantencheck-dataset") {
    const error = new Error("Unbekannter Datenpaket-Typ.");
    error.code = "DATASET_TYPE_INVALID";
    throw error;
  }

  if (manifest.schemaVersion !== PACKAGE_SCHEMA_VERSION) {
    const error = new Error(`Datenpaket-Version ${manifest.schemaVersion} wird nicht unterstützt.`);
    error.code = "DATASET_SCHEMA_UNSUPPORTED";
    throw error;
  }

  if (!manifest.datasetVersion) {
    const error = new Error("datasetVersion fehlt.");
    error.code = "DATASET_VERSION_MISSING";
    throw error;
  }

  if (!Array.isArray(manifest.segments)) {
    const error = new Error("Segmentliste fehlt.");
    error.code = "DATASET_SEGMENTS_MISSING";
    throw error;
  }

  for (const required of REQUIRED_SEGMENTS) {
    if (!manifest.segments.some(seg => seg.kind === required)) {
      const error = new Error(`Pflichtsegment "${required}" fehlt.`);
      error.code = "DATASET_SEGMENT_REQUIRED";
      error.detail = required;
      throw error;
    }
  }

  return manifest;
}
