/**
 * Disable OS / browser / password-manager strong-password suggestions.
 * `autocomplete="new-password"` is what triggers complex suggestions on phones.
 */
export const passwordNoSuggestProps = {
  autoComplete: "off",
  autoCapitalize: "off",
  autoCorrect: "off",
  spellCheck: false,
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;
