export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'stockflow-theme'

export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(theme: ThemeMode) {
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem(STORAGE_KEY, theme)
}

export function initTheme() {
  applyTheme(getStoredTheme())
}
