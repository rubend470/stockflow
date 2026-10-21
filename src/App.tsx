import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ConfirmProvider } from './context/ConfirmContext'
import { ThemeProvider } from './context/ThemeContext'
import { ProtectedRoute, PublicRoute } from './components/ProtectedRoute'
import { UserPresenceHeartbeat } from './components/UserPresenceHeartbeat'
import './App.css'
import './styles/layout.css'
import './styles/pos.css'
import './styles/inventory.css'
import './styles/finance.css'

function lazyPage<T extends ComponentType<any>>(
  loader: () => Promise<Record<string, T>>,
  exportName: string,
) {
  return lazy(async () => {
    const module = await loader()
    return { default: module[exportName] }
  })
}

const DashboardPage = lazyPage(() => import('./pages/DashboardPage'), 'DashboardPage')
const LoginPage = lazyPage(() => import('./pages/LoginPage'), 'LoginPage')
const RegisterPage = lazyPage(() => import('./pages/RegisterPage'), 'RegisterPage')
const PosPage = lazyPage(() => import('./pages/modules/sales/PosPage'), 'PosPage')
const SalesHistoryPage = lazyPage(
  () => import('./pages/modules/sales/SalesHistoryPage'),
  'SalesHistoryPage',
)
const CashClosingPage = lazyPage(
  () => import('./pages/modules/sales/CashClosingPage'),
  'CashClosingPage',
)
const PendingInvoicesPage = lazyPage(
  () => import('./pages/modules/sales/PendingInvoicesPage'),
  'PendingInvoicesPage',
)
const ProductsPage = lazyPage(() => import('./pages/modules/inventory/ProductsPage'), 'ProductsPage')
const AddProductPage = lazyPage(
  () => import('./pages/modules/inventory/AddProductPage'),
  'AddProductPage',
)
const CategoriesPage = lazyPage(
  () => import('./pages/modules/inventory/CategoriesPage'),
  'CategoriesPage',
)
const CombosPromotionsPage = lazyPage(
  () => import('./pages/modules/inventory/CombosPromotionsPage'),
  'CombosPromotionsPage',
)
const ProductTypesPage = lazyPage(
  () => import('./pages/modules/inventory/ProductTypesPage'),
  'ProductTypesPage',
)
const WastePage = lazyPage(() => import('./pages/modules/inventory/WastePage'), 'WastePage')
const SuppliersPage = lazyPage(
  () => import('./pages/modules/suppliers/SuppliersPage'),
  'SuppliersPage',
)
const DebtsPage = lazyPage(() => import('./pages/modules/clients/DebtsPage'), 'DebtsPage')
const ExpensesPage = lazyPage(() => import('./pages/modules/finance/ExpensesPage'), 'ExpensesPage')
const CashMovementsPage = lazyPage(
  () => import('./pages/modules/finance/CashMovementsPage'),
  'CashMovementsPage',
)
const CurrenciesPage = lazyPage(
  () => import('./pages/modules/finance/CurrenciesPage'),
  'CurrenciesPage',
)
const CurrencyExchangePage = lazyPage(
  () => import('./pages/modules/finance/CurrencyExchangePage'),
  'CurrencyExchangePage',
)
const PaymentsPage = lazyPage(() => import('./pages/modules/finance/PaymentsPage'), 'PaymentsPage')
const ReportsPage = lazyPage(() => import('./pages/modules/reports/ReportsPage'), 'ReportsPage')
const UsersPage = lazyPage(() => import('./pages/modules/admin/UsersPage'), 'UsersPage')
const BusinessesPage = lazyPage(
  () => import('./pages/modules/admin/BusinessesPage'),
  'BusinessesPage',
)
const SettingsPage = lazyPage(() => import('./pages/modules/admin/SettingsPage'), 'SettingsPage')
const KeyboardShortcutsPage = lazyPage(
  () => import('./pages/modules/admin/KeyboardShortcutsPage'),
  'KeyboardShortcutsPage',
)

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmProvider>
        <BrowserRouter>
        <UserPresenceHeartbeat />
        <Suspense fallback={<div className="loading-screen">Cargando...</div>}>
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
              <Route path="/inventario/ofertas" element={<CombosPromotionsPage />} />
              <Route path="/inventario/tipos-producto" element={<ProductTypesPage />} />
              <Route path="/inventario/stock" element={<Navigate to="/inventario/productos" replace />} />
              <Route path="/inventario/movimientos" element={<Navigate to="/inventario/mermas" replace />} />
              <Route path="/inventario/mermas" element={<WastePage />} />
              <Route path="/inventario/proveedores" element={<SuppliersPage />} />
              <Route path="/clientes/directorio" element={<Navigate to="/clientes/deudas" replace />} />
              <Route path="/clientes/deudas" element={<DebtsPage />} />
              <Route path="/finanzas/cambio" element={<CurrencyExchangePage />} />
              <Route path="/finanzas/gastos" element={<ExpensesPage />} />
              <Route path="/finanzas/entradas-salidas" element={<CashMovementsPage />} />
              <Route path="/finanzas/base-caja" element={<CashMovementsPage mode="opening" />} />
              <Route path="/finanzas/monedas" element={<CurrenciesPage />} />
              <Route path="/finanzas/pagos" element={<PaymentsPage />} />
              <Route path="/reportes" element={<ReportsPage />} />
              <Route path="/admin/usuarios" element={<UsersPage />} />
              <Route path="/admin/empresas" element={<BusinessesPage />} />
              <Route path="/admin/configuracion" element={<SettingsPage />} />
              <Route path="/admin/atajos" element={<KeyboardShortcutsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        </BrowserRouter>
        </ConfirmProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
