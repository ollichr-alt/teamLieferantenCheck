function norm(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("de-DE")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function prefixes(token) {
  const out = [];
  const max = Math.min(token.length, 24);
  for (let i = 2; i <= max; i++) out.push(token.slice(0, i));
  return out;
}

function searchKeys(article) {
  const raw = [article.articleNumber, article.ean, article.description, article.model]
    .map(norm)
    .filter(Boolean)
    .join(" ");
  const tokens = raw.split(/\s+/).filter(Boolean);
  return [...new Set(tokens.flatMap(token => token.length >= 2 ? prefixes(token) : [token]))];
}

self.onmessage = event => {
  try {
    const { type, rows = [] } = event.data || {};
    let normalized;

    if (type === "articles") {
      normalized = rows.map(a => {
        const row = {
          ...a,
          articleNumber: String(a.articleNumber ?? "").trim(),
          description: String(a.description ?? "").trim(),
          model: String(a.model ?? "").trim() || "—",
          supplierId: String(a.supplierId ?? "").trim(),
          ean: String(a.ean ?? "").trim()
        };
        row.searchKeys = searchKeys(row);
        return row;
      }).filter(a => a.articleNumber);
    } else if (type === "suppliers") {
      normalized = rows.map(s => ({ ...s, supplierId: String(s.supplierId ?? "").trim() }))
        .filter(s => s.supplierId);
    } else if (type === "locations") {
      normalized = rows.map(l => ({ ...l, locationId: String(l.locationId ?? "").trim() }))
        .filter(l => l.locationId);
    } else {
      normalized = rows;
    }

    self.postMessage({ ok: true, type, normalized });
  } catch (error) {
    self.postMessage({ ok: false, error: error.message || String(error) });
  }
};
