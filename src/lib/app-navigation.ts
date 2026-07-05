export function navigateApp(path: string) {
  window.location.assign(path);
}

export function goBackOrApp(fallback = "/app") {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  navigateApp(fallback);
}
