import { getAll } from "../db/idb.js";
import { STORES } from "../db/schema.js";

export async function calculateSlowMovers(limit = 20) {
  const rows = await getAll(STORES.aggregates);
  return rows
    .filter(row => row?.type === "article" && row?.slowMover === true)
    .slice(0, limit);
}
