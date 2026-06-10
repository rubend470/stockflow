import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyTheme, getStoredTheme, type ThemeMode } from '../lib/theme'

interface ThemeContextValue {
  theme: ThemeMode
  toggleTheme: () => void
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => getStoredTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: ThemeMode) => setThemeState(next),
      toggleTheme: () => setThemeState((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme debe usarse dentro de ThemeProvider')
  }
  return context
}
