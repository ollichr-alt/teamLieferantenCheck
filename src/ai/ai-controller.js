import { AI_PROVIDER } from "./contracts.js";
import { inferLocalIntent } from "./local-provider.js";
import { inferCloudflareIntent } from "./cloudflare-provider.js";
import { executeIntent } from "../commands/intent-executor.js";

export async function handleAssistantInput(input, options = {}) {
  const provider = options.provider || AI_PROVIDER.LOCAL;
  let inference;
  if (provider === AI_PROVIDER.CLOUDFLARE) {
    try {
      inference = await inferCloudflareIntent(input, options);
    } catch (error) {
      if (!options.allowLocalFallback) throw error;
      inference = await inferLocalIntent(input);
    }
  } else {
    inference = await inferLocalIntent(input);
  }
  const execution = await executeIntent(inference, options);
  return { providerUsed: provider, inference, execution };
}
