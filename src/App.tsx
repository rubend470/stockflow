import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute'
import { UserPresenceHeartbeat } from './components/UserPresenceHeartbeat'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import {
  CurrenciesPage,
  CurrencyExchangePage,
  DebtsPage,
  AddProductPage,
  CategoriesPage,
  WastePage,
  PaymentsPage,
  PendingInvoicesPage,
  PosPage,
  ProductsPage,
  ReportsPage,
  SalesHistoryPage,
  CashClosingPage,
  ExpensesPage,
  SettingsPage,
  SuppliersPage,
  UsersPage,
} from './pages/modules'
import './App.css'
import './styles/layout.css'
import './styles/pos.css'
import './styles/inventory.css'
import './styles/finance.css'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmProvider>
        <BrowserRouter>
        <UserPresenceHeartbeat />
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/ventas/pos" element={<PosPage />} />
            <Route path="/ventas/historial" element={<SalesHistoryPage />} />
            <Route path="/ventas/cierre" element={<CashClosingPage />} />
            <Route path="/ventas/facturas-pendientes" element={<PendingInvoicesPage />} />
            <Route path="/inventario/productos" element={<ProductsPage />} />
            <Route path="/inventario/productos/nuevo" element={<AddProductPage />} />
            <Route path="/inventario/categorias" element={<CategoriesPage />} />
            <Route path="/inventario/stock" element={<Navigate to="/inventario/productos" replace />} />
            <Route path="/inventario/movimientos" element={<Navigate to="/inventario/mermas" replace />} />
            <Route path="/inventario/mermas" element={<WastePage />} />
            <Route path="/inventario/proveedores" element={<SuppliersPage />} />
            <Route path="/clientes/directorio" element={<Navigate to="/clientes/deudas" replace />} />
            <Route path="/clientes/deudas" element={<DebtsPage />} />
            <Route path="/finanzas/cambio" element={<CurrencyExchangePage />} />
            <Route path="/finanzas/gastos" element={<ExpensesPage />} />
            <Route path="/finanzas/monedas" element={<CurrenciesPage />} />
            <Route path="/finanzas/pagos" element={<PaymentsPage />} />
            <Route path="/reportes" element={<ReportsPage />} />
            <Route path="/admin/usuarios" element={<UsersPage />} />
            <Route path="/admin/configuracion" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </BrowserRouter>
        </ConfirmProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
