import { AI_INTENTS } from "../ai/contracts.js";
import { assertActionAllowed } from "../ai/permission-guard.js";
import { navigateTo } from "./navigation.js";
import { calculateProblemCapital } from "../analytics/problem-capital.js";
import { calculateSlowMovers } from "../analytics/slow-movers.js";

export async function executeIntent(inference, options = {}) {
  const intent = inference?.intent;

  switch (intent) {
    case AI_INTENTS.SHOW_SUPPLIER:
      assertActionAllowed("open_supplier");
      return navigateTo("supplier", inference.entities);
    case AI_INTENTS.SHOW_LOCATION:
      assertActionAllowed("open_location");
      return navigateTo("location", inference.entities);
    case AI_INTENTS.SEARCH_ARTICLE:
      assertActionAllowed("search");
      return navigateTo("search", inference.entities);
    case AI_INTENTS.ANALYZE_PROBLEM_CAPITAL:
      assertActionAllowed("analyze");
      return { ok: true, type: "analysis", analysis: "problem_capital", data: await calculateProblemCapital(10) };
    case AI_INTENTS.ANALYZE_SLOW_MOVERS:
      assertActionAllowed("analyze");
      return { ok: true, type: "analysis", analysis: "slow_movers", data: await calculateSlowMovers(20) };
    default:
      return { ok: false, type: "unknown", message: "Befehl noch nicht erkannt." };
  }
}
