export async function inferCloudflareIntent() {
  const error = new Error("Cloudflare AI ist noch nicht konfiguriert.");
  error.code = "AI_CLOUDFLARE_NOT_CONFIGURED";
  throw error;
}
