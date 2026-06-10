import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthLayout, AuthLink } from '../components/AuthLayout'
import { login } from '../services/authService'
import { getAuthErrorMessage } from '../utils/authErrors'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      await login(email.trim(), password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(getAuthErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Iniciar sesión"
      subtitle="Ingresa a tu cuenta de StockFlow"
      footer={
        <>
          ¿No tienes cuenta? <AuthLink to="/register">Regístrate</AuthLink>
        </>
      }
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}

        <label className="auth-field">
          <span>Correo electrónico</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="auth-field">
          <span>Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" className="auth-button" disabled={submitting}>
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </AuthLayout>
  )
}
