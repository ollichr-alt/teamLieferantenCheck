import { SAFE_ACTIONS, CONFIRM_ACTIONS } from "./contracts.js";

export function classifyAction(action) {
  if (SAFE_ACTIONS.has(action)) return { allowed: true, requiresConfirmation: false };
  if (CONFIRM_ACTIONS.has(action)) return { allowed: true, requiresConfirmation: true };
  return { allowed: false, requiresConfirmation: false };
}

export function assertActionAllowed(action) {
  const result = classifyAction(action);
  if (!result.allowed) {
    const error = new Error(`Aktion "${action}" ist nicht freigegeben.`);
    error.code = "AI_ACTION_NOT_ALLOWED";
    throw error;
  }
  return result;
}
