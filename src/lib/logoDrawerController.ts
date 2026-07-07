import { track } from "@vercel/analytics";
import { copyLogo, downloadLogo } from "./logoActions";
import type { Bank, BankSelectDetail, BankSelectSource, LogoFormat } from "../types/bank";

const SHEET_MS = 360;
const MODAL_MS = 260;
const SUCCESS_MS = 1800;

const SUCCESS_LABEL: Record<"copy" | "download", string> = {
  copy: "Copied",
  download: "Downloaded",
};

function successButtonMarkup(label: string): string {
  return `<span class="ld__btn-check" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="ld__btn-label">${label}</span>`;
}

function bindLogoDrawer(drawer: HTMLElement, source: BankSelectSource) {
  const shell = drawer.closest<HTMLElement>(".bc-inner, .dm-sidebar");
  const scrollContainer = shell?.querySelector<HTMLElement>(".bc-list");
  const isSheet = drawer.classList.contains("ld--sheet");
  const closeMs = isSheet ? SHEET_MS : MODAL_MS;

  const titleEl = drawer.querySelector<HTMLElement>(".ld__title")!;
  const previewEl = drawer.querySelector<HTMLImageElement>(".ld__preview-img")!;
  const previewWrap = drawer.querySelector<HTMLElement>(".ld__preview-wrap")!;
  const toastEl = drawer.querySelector<HTMLElement>(".ld__toast")!;
  const actionButtons = drawer.querySelectorAll<HTMLButtonElement>(".ld__btn");

  actionButtons.forEach((btn) => {
    if (!btn.dataset.defaultLabel) {
      btn.dataset.defaultLabel = btn.textContent?.trim() ?? "";
    }
  });

  let currentBank: Bank | null = null;
  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  let lastFocused: HTMLElement | null = null;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let savedScrollTop = 0;
  const successTimers = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();

  function lockShell() {
    if (!shell) return;
    shell.classList.add("ld-shell--locked");
    if (scrollContainer) {
      savedScrollTop = scrollContainer.scrollTop;
      scrollContainer.style.overflow = "hidden";
    }
  }

  function unlockShell() {
    if (!shell) return;
    shell.classList.remove("ld-shell--locked");
    if (scrollContainer) {
      scrollContainer.style.overflow = "";
      scrollContainer.scrollTop = savedScrollTop;
    }
  }

  function showToast(message: string) {
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.dataset.ok = "false";
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2800);
  }

  function resetButtonSuccess(btn: HTMLButtonElement) {
    const timer = successTimers.get(btn);
    if (timer) clearTimeout(timer);
    successTimers.delete(btn);
    btn.classList.remove("ld__btn--success");
    btn.textContent = btn.dataset.defaultLabel ?? "";
    btn.removeAttribute("aria-label");
  }

  function resetAllButtonSuccess() {
    actionButtons.forEach((btn) => resetButtonSuccess(btn));
  }

  function showButtonSuccess(
    btn: HTMLButtonElement,
    action: "copy" | "download",
  ) {
    resetButtonSuccess(btn);
    const label = SUCCESS_LABEL[action];
    btn.innerHTML = successButtonMarkup(label);
    btn.classList.add("ld__btn--success");
    btn.setAttribute("aria-label", label);
    successTimers.set(
      btn,
      window.setTimeout(() => resetButtonSuccess(btn), SUCCESS_MS),
    );
  }

  function openDrawer(detail: BankSelectDetail) {
    if (detail.source !== source) return;

    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }

    resetAllButtonSuccess();
    toastEl.hidden = true;

    currentBank = detail.bank;
    titleEl.textContent = detail.bank.name;
    previewEl.src = detail.bank.logos.png;
    previewEl.alt = detail.bank.name;
    previewWrap.dataset.style = detail.style;

    lastFocused = document.activeElement as HTMLElement | null;
    lockShell();

    drawer.removeAttribute("hidden");
    drawer.setAttribute("aria-hidden", "false");
    drawer.classList.add("ld--visible");
    drawer.classList.remove("ld--open");

    // Ensure the closed state paints before animating open.
    void drawer.offsetHeight;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        drawer.classList.add("ld--open");
      });
    });

    window.setTimeout(() => {
      const focusTarget = isSheet
        ? actionButtons[0]
        : drawer.querySelector<HTMLButtonElement>(".ld__close");
      focusTarget?.focus({ preventScroll: true });
    }, 50);
  }

  function closeDrawer() {
    drawer.classList.remove("ld--open");
    drawer.setAttribute("aria-hidden", "true");
    unlockShell();
    resetAllButtonSuccess();

    if (closeTimer) clearTimeout(closeTimer);
    closeTimer = window.setTimeout(() => {
      drawer.classList.remove("ld--visible");
      drawer.setAttribute("hidden", "");
      closeTimer = null;
    }, closeMs);

    currentBank = null;
    if (lastFocused) {
      lastFocused.focus({ preventScroll: true });
      lastFocused = null;
    }
  }

  async function runAction(
    btn: HTMLButtonElement,
    action: "copy" | "download",
    format: LogoFormat,
    label: string,
  ) {
    if (!currentBank || btn.disabled) return;

    const url = currentBank.logos[format];
    if (!url) {
      showToast(`${format.toUpperCase()} not available for this bank`);
      return;
    }

    btn.disabled = true;
    track(label);

    const result =
      action === "copy"
        ? await copyLogo(url, format)
        : await downloadLogo(url, currentBank.name, format);

    btn.disabled = false;

    if (result.ok) {
      showButtonSuccess(btn, action);
    } else {
      showToast(result.message);
    }
  }

  window.addEventListener("bank:select", (e) => {
    openDrawer((e as CustomEvent<BankSelectDetail>).detail);
  });

  drawer.addEventListener("click", (e) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-ld-close]")) {
      closeDrawer();
      return;
    }

    const btn = target.closest<HTMLButtonElement>("[data-action]");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "copy-png") runAction(btn, "copy", "png", "Logo Copy PNG");
    if (action === "copy-svg") runAction(btn, "copy", "svg", "Logo Copy SVG");
    if (action === "download-png")
      runAction(btn, "download", "png", "Logo Download PNG");
    if (action === "download-svg")
      runAction(btn, "download", "svg", "Logo Download SVG");
  });

  document.addEventListener("keydown", (e) => {
    if (!drawer.classList.contains("ld--visible")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      closeDrawer();
      return;
    }

    if (e.key !== "Tab") return;

    const focusable = drawer.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  });
}

export function initLogoDrawers() {
  document
    .querySelectorAll<HTMLElement>(".ld[data-source]:not([data-ld-bound])")
    .forEach((drawer) => {
      const source = drawer.dataset.source as BankSelectSource | undefined;
      if (!source) return;
      drawer.dataset.ldBound = "true";
      bindLogoDrawer(drawer, source);
    });
}
