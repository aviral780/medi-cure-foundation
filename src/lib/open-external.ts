/**
 * Always open external resources in a brand-new browser tab.
 * Never embed, never route internally — works from inside the preview iframe too.
 */

/** Synthetic top-level link click — allowed in more contexts than scripted popups. */
function anchorFallback(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function openExternal(url: string): void {
  if (!url) return;
  // NOTE: passing "noopener" to window.open always returns null, so the return
  // value can no longer be used to detect a blocked popup. Open without it and
  // sever `opener` manually instead.
  let win: Window | null = null;
  try {
    win = window.open(url, "_blank");
  } catch {
    win = null;
  }
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* cross-origin: already isolated */
    }
    return;
  }
  anchorFallback(url);
}

/**
 * Open a URL that is only known asynchronously (e.g. a signed storage URL).
 *
 * Popup blockers only honour `window.open` while the user-gesture token is
 * alive, which an `await` destroys. So we claim a blank tab synchronously
 * inside the click handler and point it at the URL once it resolves.
 */
export async function openExternalAsync(resolveUrl: () => Promise<string>): Promise<void> {
  let win: Window | null = null;
  try {
    win = window.open("", "_blank");
  } catch {
    win = null;
  }
  try {
    const url = await resolveUrl();
    if (!url) {
      win?.close();
      return;
    }
    if (win && !win.closed) {
      try {
        win.opener = null;
      } catch {
        /* noop */
      }
      win.location.replace(url);
      return;
    }
    anchorFallback(url);
  } catch (err) {
    win?.close();
    throw err;
  }
}