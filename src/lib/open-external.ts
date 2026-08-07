/**
 * Always open external resources in a brand-new browser tab.
 * Never embed, never route internally — works from inside the preview iframe too.
 */
export function openExternal(url: string): void {
  if (!url) return;
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) {
    win.opener = null;
    return;
  }
  // Popup blocked (common inside iframes) — fall back to a synthetic top-level link.
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}