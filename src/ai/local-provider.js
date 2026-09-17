import { AI_INTENTS } from "./contracts.js";

function normalize(input) {
  return String(input || "").trim().toLocaleLowerCase("de-DE");
}

export async function inferLocalIntent(input) {
  const text = normalize(input);
  if (!text) return { intent: AI_INTENTS.UNKNOWN, confidence: 0 };

  if (text.startsWith("/lieferant ")) {
    return { intent: AI_INTENTS.SHOW_SUPPLIER, confidence: 1, entities: { supplier: text.slice("/lieferant ".length).trim() } };
  }
  if (text.startsWith("/standort ")) {
    return { intent: AI_INTENTS.SHOW_LOCATION, confidence: 1, entities: { location: text.slice("/standort ".length).trim() } };
  }
  if (text.includes("problemkapital")) {
    return { intent: AI_INTENTS.ANALYZE_PROBLEM_CAPITAL, confidence: 0.92, entities: {} };
  }
  if (text.includes("penner") || text.includes("langsamdreher")) {
    return { intent: AI_INTENTS.ANALYZE_SLOW_MOVERS, confidence: 0.9, entities: {} };
  }
  if (text.startsWith("/suche ")) {
    return { intent: AI_INTENTS.SEARCH_ARTICLE, confidence: 1, entities: { query: text.slice("/suche ".length).trim() } };
  }
  return { intent: AI_INTENTS.UNKNOWN, confidence: 0.2, entities: {} };
}
