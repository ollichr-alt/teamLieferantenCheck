import { openDb, getActiveSlot } from "./db/idb.js";
import { STORES } from "./db/schema.js";

function norm(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function searchArticles(query, limit = 50) {
  const slot = await getActiveSlot();
  if (!slot) return [];

  const tokens = norm(query).split(/\s+/).filter(token => token.length >= 2);
  if (!tokens.length) return [];

  const db = await openDb();
  const tx = db.transaction(STORES.articles, "readonly");
  const index = tx.objectStore(STORES.articles).index("searchKeys");

  const sets = [];
  for (const token of tokens) {
    const req = index.getAll(token, 500);
    const rows = await new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    sets.push(rows.filter(row => row.slot === slot));
  }

  if (!sets.length) return [];
  const first = sets[0];
  const otherKeys = sets.slice(1).map(rows => new Set(rows.map(r => r.articleNumber)));
  return first.filter(row => otherKeys.every(set => set.has(row.articleNumber))).slice(0, limit);
}
