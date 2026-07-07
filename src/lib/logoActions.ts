import type { ActionResult, LogoFormat } from "../types/bank";

export function sanitizeFilename(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function fetchLogoBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch logo (${res.status})`);
  }
  return res.blob();
}

export async function downloadLogo(
  url: string,
  bankName: string,
  format: LogoFormat,
): Promise<ActionResult> {
  try {
    const blob = await fetchLogoBlob(url);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `${sanitizeFilename(bankName) || "bank-logo"}.${format}`;
    anchor.click();
    URL.revokeObjectURL(objectUrl);
    return { ok: true, message: `Downloaded ${format.toUpperCase()}` };
  } catch {
    return {
      ok: false,
      message: `Couldn't download ${format.toUpperCase()} — try again`,
    };
  }
}

function supportsClipboardMime(mime: string): boolean {
  return (
    typeof ClipboardItem !== "undefined" &&
    typeof ClipboardItem.supports === "function" &&
    ClipboardItem.supports(mime)
  );
}

async function writeClipboardItem(
  items: Record<string, Blob | Promise<Blob>>,
): Promise<void> {
  const wrapped = Object.fromEntries(
    Object.entries(items).map(([mime, blob]) => [
      mime,
      blob instanceof Blob ? Promise.resolve(blob) : blob,
    ]),
  );
  await navigator.clipboard.write([new ClipboardItem(wrapped)]);
}

async function copyPngToClipboard(url: string): Promise<ActionResult> {
  const blob = await fetchLogoBlob(url);
  const pngBlob =
    blob.type === "image/png"
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: "image/png" });

  await writeClipboardItem({ "image/png": pngBlob });
  return { ok: true, message: "Copied PNG to clipboard" };
}

async function copySvgToClipboard(url: string): Promise<ActionResult> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch logo (${res.status})`);
  }

  const svgText = (await res.text()).trim();
  if (!svgText.includes("<svg")) {
    return { ok: false, message: "Invalid SVG file" };
  }

  const plainBlob = new Blob([svgText], { type: "text/plain" });
  const clipboardItems: Record<string, Blob> = {
    "text/plain": plainBlob,
  };

  // image/svg+xml is optional — Safari/Firefox often lack it; design apps
  // like Figma also accept SVG via text/plain.
  if (supportsClipboardMime("image/svg+xml")) {
    clipboardItems["image/svg+xml"] = new Blob([svgText], {
      type: "image/svg+xml",
    });
  }

  if (typeof ClipboardItem !== "undefined") {
    try {
      await writeClipboardItem(clipboardItems);
      return { ok: true, message: "Copied SVG to clipboard" };
    } catch {
      // Fall through to writeText.
    }
  }

  await navigator.clipboard.writeText(svgText);
  return { ok: true, message: "Copied SVG to clipboard" };
}

export async function copyLogo(
  url: string,
  format: LogoFormat,
): Promise<ActionResult> {
  if (!navigator.clipboard?.write && !navigator.clipboard?.writeText) {
    return {
      ok: false,
      message: "Clipboard not supported — use Download instead",
    };
  }

  try {
    return format === "png"
      ? await copyPngToClipboard(url)
      : await copySvgToClipboard(url);
  } catch {
    return {
      ok: false,
      message: `Couldn't copy ${format.toUpperCase()} — try Download instead`,
    };
  }
}
