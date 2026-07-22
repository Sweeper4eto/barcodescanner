"use client";

import { useEffect } from "react";
import {
  clearDeferredInstallPrompt,
  setDeferredInstallPrompt,
  type BeforeInstallPromptEventLike,
} from "@/lib/pwa-install";

export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Service worker is optional; app works without it.
      });
    }

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEventLike);
    }

    function onInstalled() {
      clearDeferredInstallPrompt();
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}