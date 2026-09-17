import { getAll } from "../db/idb.js";
import { STORES } from "../db/schema.js";

export async function calculateProblemCapital(limit = 10) {
  const rows = await getAll(STORES.aggregates);
  const relevant = rows
    .filter(row => row?.type === "supplier" && Number.isFinite(Number(row.problemCapital)))
    .sort((a, b) => Number(b.problemCapital) - Number(a.problemCapital))
    .slice(0, limit);

  return relevant.map(row => ({
    supplierId: row.supplierId,
    supplierName: row.supplierName || row.supplierId,
    problemCapital: Number(row.problemCapital || 0)
  }));
}
