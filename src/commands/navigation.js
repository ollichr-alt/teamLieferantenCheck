export function navigateTo(target, params = {}) {
  window.dispatchEvent(new CustomEvent("lieferantencheck:navigate", {
    detail: { target, params }
  }));
  return { ok: true, target, params };
}
