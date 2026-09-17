export const AI_PROVIDER = {
  LOCAL: "local",
  CLOUDFLARE: "cloudflare"
};

export const AI_INTENTS = {
  NAVIGATE: "navigate",
  SEARCH_ARTICLE: "search_article",
  ANALYZE_PROBLEM_CAPITAL: "analyze_problem_capital",
  ANALYZE_SLOW_MOVERS: "analyze_slow_movers",
  SHOW_SUPPLIER: "show_supplier",
  SHOW_LOCATION: "show_location",
  WORKSPACE_ACTION: "workspace_action",
  UNKNOWN: "unknown"
};

export const SAFE_ACTIONS = new Set([
  "navigate",
  "search",
  "analyze",
  "open_supplier",
  "open_location"
]);

export const CONFIRM_ACTIONS = new Set([
  "workspace_write",
  "workspace_delete",
  "workspace_import",
  "workspace_replace"
]);
