import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface Window {
    __pwaInstallPrompt: BeforeInstallPromptEvent | null;
  }
}

const isIOS = () => /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    if (isIOS()) {
      setCanInstall(true);
      return;
    }

    // Check if the event was captured by the inline script in index.html
    // (fires before any JS module loads — the earliest possible capture point)
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
      setCanInstall(true);
    }

    // Also listen for future firings.
    // Do NOT preventDefault here — that triggers a Chrome devtools warning
    // unless followed immediately by prompt(). preventDefault happens right
    // before prompt() in install() instead.
    const handler = (e: Event) => {
      const prompt = e as BeforeInstallPromptEvent;
      window.__pwaInstallPrompt = prompt;
      setDeferredPrompt(prompt);
      setCanInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Fallback: still show the button if the event never fires
    const timer = setTimeout(() => {
      if (!window.__pwaInstallPrompt) setCanInstall(true);
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      clearTimeout(timer);
    };
  }, []);

  const install = async () => {
    if (isIOS()) {
      alert('To install: tap the Share button in Safari then select "Add to Home Screen".');
      return;
    }

    const prompt = deferredPrompt || window.__pwaInstallPrompt;
    if (prompt) {
      // preventDefault only when we're actually prompting the user — avoids the
      // Chrome "Banner not shown" warning that's logged when preventDefault is
      // called without a follow-up prompt() call.
      prompt.preventDefault();
      prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setCanInstall(false);
      }
      window.__pwaInstallPrompt = null;
      setDeferredPrompt(null);
      return;
    }

    // No prompt available — guide the user
    const isChrome = /chrome|chromium|crios/i.test(navigator.userAgent);
    const isEdge   = /edg\//i.test(navigator.userAgent);
    if (isChrome || isEdge) {
      alert('Click the install icon in your browser\'s address bar to install.');
    } else {
      alert('Open your browser\'s menu and choose "Install app" or "Add to Home Screen".');
    }
  };

  return { canInstall, isInstalled, install };
}
