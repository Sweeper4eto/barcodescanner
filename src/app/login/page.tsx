import { cookies } from "next/headers";
import Script from "next/script";
import { AuthShell, LoginForm } from "@/components/auth-forms";
import { MobileI18nProvider } from "@/components/mobile-i18n-provider";
import { t, type Locale, type MessageKey } from "@/i18n";
import { isMobileLocale } from "@/lib/client-locale";

function errorMessageForCode(code: string | undefined, locale: Locale): string {
  if (!code) return "";
  const key: MessageKey | null =
    code === "locked"
      ? "auth.tooManyAttempts"
      : code === "no-client"
        ? "auth.noClientAssigned"
        : code === "credentials" || code === "1"
          ? "auth.invalidCredentials"
          : "auth.loginError";
  return t(key, undefined, locale);
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("magazin-locale")?.value ?? "";
  const locale: Locale = isMobileLocale(rawLocale) ? rawLocale : "en";
  const initialError = errorMessageForCode(params.error, locale);

  return (
    <MobileI18nProvider>
      <div className="pt-[max(0.5rem,env(safe-area-inset-top,0px))]">
        <AuthShell
          title={t("auth.loginSubtitle", undefined, locale)}
          showLanguageSwitch
        >
          <LoginForm initialError={initialError} />
        </AuthShell>
      </div>
      {/* Kill stale service workers on LAN even when React fails to hydrate. */}
      <Script id="login-clear-sw-lan" strategy="beforeInteractive">
        {`(function(){
  try {
    var h = location.hostname;
    var lan = h === 'localhost' || h === '127.0.0.1' ||
      /^192\\.168\\.\\d+\\.\\d+$/.test(h) ||
      /^10\\.\\d+\\.\\d+\\.\\d+$/.test(h);
    if (!lan || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.getRegistrations().then(function(regs){
      regs.forEach(function(r){ r.unregister(); });
    });
    if ('caches' in window) {
      caches.keys().then(function(keys){
        keys.forEach(function(k){ caches.delete(k); });
      });
    }
  } catch (e) {}
})();`}
      </Script>
      {/* Swap only the submit button contents for a spinner (no fullscreen overlay). */}
      <Script id="login-busy-button" strategy="beforeInteractive">
        {`(function(){
  document.addEventListener('submit', function(ev){
    var form = ev.target;
    if (!form || !form.getAttribute || form.getAttribute('data-login-form') == null) return;
    var btn = form.querySelector('button[type="submit"]');
    if (!btn || btn.getAttribute('data-login-busy') === '1') return;
    btn.setAttribute('data-login-busy', '1');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.replaceChildren();
    var spin = document.createElement('span');
    spin.className = 'document-processing-spinner';
    spin.style.width = '1.25rem';
    spin.style.height = '1.25rem';
    spin.setAttribute('aria-hidden', 'true');
    btn.appendChild(spin);
  }, true);
})();`}
      </Script>
      {/* Works even when the React bundle fails to hydrate (common on LAN/PWA). */}
      <Script id="login-toggle-password" strategy="beforeInteractive">
        {`(function(){
  document.addEventListener('click', function(ev){
    var el = ev.target;
    if (!el || !el.closest) return;
    var btn = el.closest('[data-toggle-password]');
    if (!btn) return;
    ev.preventDefault();
    var sel = btn.getAttribute('data-toggle-password');
    var input = sel ? document.querySelector(sel) : null;
    if (!input) return;
    var showing = input.getAttribute('type') === 'password';
    input.setAttribute('type', showing ? 'text' : 'password');
    btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
    var showLabel = btn.getAttribute('data-label-show') || 'Show password';
    var hideLabel = btn.getAttribute('data-label-hide') || 'Hide password';
    btn.setAttribute('aria-label', showing ? hideLabel : showLabel);
    var eyeHidden = btn.querySelector('[data-eye-hidden]');
    var eyeShown = btn.querySelector('[data-eye-shown]');
    if (eyeHidden && eyeShown) {
      if (showing) {
        eyeHidden.setAttribute('hidden', '');
        eyeShown.removeAttribute('hidden');
      } else {
        eyeShown.setAttribute('hidden', '');
        eyeHidden.removeAttribute('hidden');
      }
    }
  }, true);
})();`}
      </Script>
    </MobileI18nProvider>
  );
}
