import { useTheme } from '../../context/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
      title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
    >
      {theme === 'light' ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a1 1 0 0 1 1 1v1.1A6.9 6.9 0 0 1 18.9 11H20a1 1 0 1 1 0 2h-1.1A6.9 6.9 0 0 1 13 18.9V20a1 1 0 1 1-2 0v-1.1A6.9 6.9 0 0 1 5.1 13H4a1 1 0 1 1 0-2h1.1A6.9 6.9 0 0 1 11 5.1V4a1 1 0 0 1 1-1Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 14.5A7.5 7.5 0 0 1 9.5 3a6 6 0 1 0 11.5 11.5Z" />
        </svg>
      )}
    </button>
  )
}
