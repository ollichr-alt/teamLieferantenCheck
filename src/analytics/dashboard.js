import { getAll } from "../db/idb.js";
import { STORES } from "../db/schema.js";

export async function getDashboardSummary() {
  const rows = await getAll(STORES.aggregates);

  const global = rows.find(row => row?.type === "global") || {};
  const supplierRows = rows.filter(row => row?.type === "supplier");

  return {
    revenue: Number(global.revenue || 0),
    stockValue: Number(global.stockValue || 0),
    problemCapital: Number(global.problemCapital || 0),
    slowMovers: Number(global.slowMovers || 0),
    supplierCount: supplierRows.length
  };
}
