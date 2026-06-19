# StockFlow - Contexto para Agentes

## Resumen General

StockFlow es un sistema web de ventas, inventario y caja para un abasto/charcutería.

Stack:

- React 19 + TypeScript + Vite
- Firebase Auth
- Firestore
- Firebase Hosting
- Moneda base: COP
- Proyecto Firebase: `stockflow-749ad`
- Hosting: `https://stockflow-sistem.web.app`

Firestore es la fuente de verdad. La app escribe ventas, compras, pagos, movimientos de inventario y cierres directamente en Firestore mediante servicios en `src/services/`.

## Roles y Acceso

Roles actuales:

```ts
super_admin | admin | cashier
```

Además del rol existe control por menú:

```ts
users/{uid}.menuPermissions: string[]
```

Cada usuario puede tener una lista de opciones visibles, por ejemplo:

```ts
['home', 'pos', 'sales-history', 'client-debts']
```

El `super_admin` siempre ve todo. Usuarios existentes sin `menuPermissions` usan permisos por defecto según su rol.
Default conservador de `cashier`: `home`, `pos`, `currency-exchange`, `client-debts`, `sales-history`.
Reportes, cierres, inventario administrativo, proveedores, finanzas y configuración deben asignarse explícitamente o venir de un perfil admin legacy.

La navegación está en `src/config/navigation.ts`. El filtro y protección de rutas está en `src/utils/menuPermissions.ts`.

## Rutas Principales

### Ventas y caja

- `/ventas/pos` - punto de venta.
- `/finanzas/cambio` - cambio de moneda.
- `/clientes/deudas` - deudas de clientes y préstamos.
- `/ventas/historial` - historial de ventas.
- `/ventas/cierre` - cierre de caja.
- `/reportes` - reportes.

### Inventario

- `/inventario/productos` - productos.
- `/inventario/productos/nuevo` - alta rápida de producto.
- `/inventario/categorias` - categorías globales de stock.
- `/ventas/facturas-pendientes` - facturas de entrada de mercancía.
- `/inventario/proveedores` - proveedores.

### Administración

- `/admin/usuarios` - usuarios, permisos de menú, roles y estado.
- `/admin/configuracion` - datos del negocio.

Rutas legacy:

- `/inventario/stock` redirige a productos.
- `/inventario/movimientos` redirige a productos.

## Colecciones Firestore

### `users/{uid}`

Usuarios del sistema.

```ts
{
  name: string
  email: string
  role: 'super_admin' | 'admin' | 'cashier'
  active: boolean
  menuPermissions?: string[]
  createdAt: Timestamp
}
```

Notas:

- El primer registro público se vuelve `super_admin`.
- Los siguientes registros entran como `cashier`.
- Desde Admin se editan rol, estado y permisos de menú.
- El registro público se usa para crear cajeros.

### `settings/app`

Configuración general del negocio.

```ts
{
  businessName: string
  address: string
  phone: string
  baseCurrency: string
  taxEnabled: boolean
  taxRate: number
  lowStockAlertEnabled: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}
```

Pendiente: `taxEnabled` y `taxRate` existen, pero el POS todavía no aplica IVA.

### `products/{id}`

Catálogo de productos vendibles.

```ts
{
  name: string
  barcode?: string
  sku?: string
  stockCategoryId?: string
  type: 'abasto' | 'charcuteria'
  soldBy: 'unit' | 'weight'
  unitLabel: string
  currencyCode: string
  allowsBundle: boolean
  unitsPerBundle?: number
  costPrice: number
  salePrice: number
  bundleCostPrice?: number
  bundleSalePrice?: number
  stock: number
  minStock: number
  active: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}
```

Reglas:

- Si `stockCategoryId` existe, el producto descuenta del stock global de una categoría.
- Si no tiene `stockCategoryId`, usa su propio `products.stock`.
- En venta se congela `unitCost` y `unitPrice` en el item de venta.
- Productos por peso usan cantidades decimales.

### `stock_categories/{id}`

Categorías globales de inventario, usadas para charcutería/desposte.

Ejemplo: `Pollo` con 50 kg. Productos como pechuga, muslo o alas descuentan de ese stock.

```ts
{
  name: string
  unitLabel: string
  stock: number
  minStock: number
  active: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}
```

Reglas:

- Entrada de mercancía puede sumar directamente a una categoría global.
- Ventas de productos derivados descuentan de esa categoría.
- También existe entrada manual desde Categorías, pero el flujo preferido es por factura de entrada.

### `inventory_movements/{id}`

Bitácora de movimientos de stock.

```ts
{
  productId?: string | null
  stockCategoryId?: string | null
  productName: string
  type: 'purchase' | 'sale' | 'adjustment' | 'waste' | 'return'
  quantity: number
  unitCost?: number
  referenceType?: 'sale' | 'purchase_invoice' | null
  referenceId?: string | null
  notes?: string
  createdAt: Timestamp
  createdBy: string
  createdByName?: string
}
```

Toda venta y entrada de mercancía debe crear movimiento.

### `suppliers/{id}`

Proveedores.

```ts
{
  name: string
  phone?: string | null
  email?: string | null
  taxId?: string | null
  notes?: string | null
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Reglas:

- Solo el nombre es obligatorio.
- Al crear factura de entrada, si el proveedor no existe, se crea automáticamente.
- Facturas nuevas guardan `supplierId` y `supplierName`.
- Facturas antiguas sin `supplierId` se relacionan por nombre.

### `purchase_invoices/{id}`

Facturas de entrada de mercancía de proveedores.

```ts
{
  number: string
  supplierId?: string
  supplierName: string
  supplierInvoiceNumber?: string | null
  currencyCode: string
  amountInBase: number
  exchangeRateSnapshot: Record<string, number>
  status: 'pending' | 'received' | 'partial' | 'paid' | 'cancelled'
  totalAmount: number
  amountPaid: number
  amountDue: number
  notes?: string | null
  invoiceDate?: string
  expectedDate?: string
  lines: PurchaseInvoiceLine[]
  createdAt: Timestamp
  updatedAt?: Timestamp
  receivedAt?: Timestamp
  receivedBy?: string
  createdBy?: string
}
```

Líneas:

```ts
{
  productId: string
  stockCategoryId?: string
  description: string
  quantity: number
  unitLabel: string
  unitCost: number
  unitCostInBase: number
  lineTotal: number
  receivedAsBundles?: boolean
  bundleCount?: number
  bundleUnitCost?: number
  unitsPerBundle?: number
}
```

Reglas:

- Al crear factura, se recibe inventario de inmediato.
- Las líneas pueden ser producto o categoría global.
- Producto: suma a `products.stock` o a su `stockCategoryId`.
- Categoría global: suma directamente a `stock_categories.stock`.
- Permite bultos si el producto tiene `allowsBundle`.
- Permite actualizar precio de venta al recibir.
- Si `amountDue <= 0`, estado `paid`.
- Si pagó parcialmente, estado `partial`.
- Si no pagó todo, estado `received` o `partial`.

Pendientes:

- Los abonos a proveedores no tienen colección propia de historial.
- Los pagos a proveedores aún no entran al cierre de caja.

### `currencies/{id}`

Monedas activas.

```ts
{
  code: string
  name: string
  symbol: string
  active: boolean
  isBase: boolean
  createdAt: Timestamp
}
```

### `exchange_rates/{id}`

Tasas entre monedas.

```ts
{
  fromCurrency: string
  toCurrency: string
  fromAmount: number
  toAmount: number
  effectiveDate: string
  createdAt: Timestamp
  createdBy: string
}
```

Cada dirección es independiente: USD -> COP y COP -> USD.

### `payment_methods/{id}`

Métodos de pago.

```ts
{
  name: string
  code: string
  active: boolean
  allowedCurrencies: string[]
  requiresReference: boolean
  isDefaultForSales: boolean
  sortOrder: number
}
```

Se usan en POS, cobros de deudas, préstamos y cambio de moneda.

### `currency_exchanges/{id}`

Operaciones de cambio de moneda.

```ts
{
  cashInCurrency: string
  cashInAmount: number
  cashInMethodId: string
  cashInMethodName: string
  cashInReference?: string
  cashOutCurrency: string
  cashOutAmount: number
  cashOutMethodId: string
  cashOutMethodName: string
  cashOutReference?: string
  conversionFactor: number
  rateLabel: string
  amountInBase: number
  baseCurrency: string
  exchangeRateSnapshot: Record<string, number>
  clientName?: string
  notes?: string
  createdAt: Timestamp
  createdBy: string
  createdByName: string
}
```

Lo que entra y sale de caja se refleja en el cierre diario.

### `clients/{id}`

Clientes para fiado/deudas.

```ts
{
  name: string
  phone?: string
  email?: string
  documentId?: string
  creditLimit: number
  balance: number
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Reglas:

- En venta normal no se requiere cliente.
- En venta a crédito sí se requiere cliente con nombre y teléfono.
- El teléfono se normaliza y se usa para encontrar clientes frecuentes.

### `sales/{id}`

Venta confirmada.

```ts
{
  number: string
  status: 'completed' | 'partial' | 'pending' | 'cancelled'
  cashierId: string
  cashierName: string
  cashSessionId?: string | null
  clientId?: string | null
  clientName?: string | null
  subtotal: number
  discount: number
  tax: number
  total: number
  baseCurrency: string
  exchangeRateSnapshot: Record<string, number>
  profitTotal: number | null
  paymentStatus: 'paid' | 'partial' | 'pending'
  cashPaid?: number
  creditPaid?: number
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

Reglas:

- Cada venta queda asociada a `cashierId` y `cashierName`.
- No hay turnos de caja todavía; `cashSessionId` existe pero no se usa.
- `profitTotal` se calcula con snapshots de costo/precio.
- Ventas a crédito registran ganancia al confirmar, no al cobrar.

### `sales/{saleId}/items/{itemId}`

Items congelados de la venta.

```ts
{
  productId: string
  productName: string
  barcode?: string
  soldBy: 'unit' | 'weight'
  saleMode: 'retail' | 'bundle'
  quantity: number
  unit: string
  unitsPerBundle?: number
  stockQuantity: number
  unitCost: number
  unitPrice: number
  lineCost: number
  lineRevenue: number
  lineProfit: number
  createdAt: Timestamp
}
```

Regla crítica: `unitCost` y `unitPrice` son snapshot. No recalcular ventas históricas con precios actuales.

### `sales/{saleId}/payments/{paymentId}`

Pagos de venta.

```ts
{
  methodId: string
  methodName: string
  currencyCode: string
  amount: number
  amountInBase: number
  reference?: string
  isCredit?: boolean
  isDebtCollection?: boolean
  debtPaymentId?: string
  clientId?: string
  clientName?: string
  createdAt?: Timestamp
}
```

Reglas:

- `isCredit` no entra a caja al vender.
- `isDebtCollection` no debe contarse doble en cierre; se usa `debt_payments`.

### `debts/{id}`

Deudas por fiado o manuales.

```ts
{
  clientId: string
  clientName: string
  saleId?: string
  originalAmount: number
  balance: number
  status: 'active' | 'paid' | 'overdue'
  dueDate?: string
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
```

### `debt_payments/{id}`

Abonos a deudas.

```ts
{
  debtId: string
  clientId: string
  amount: number
  currencyCode: string
  amountInBase: number
  methodName: string
  reference?: string
  createdAt: Timestamp
  createdBy: string
  createdByName?: string
}
```

Entran al cierre de caja como ingreso.

### `loans/{id}`

Préstamos de dinero entregado.

```ts
{
  borrowerName: string
  borrowerPhone: string
  currencyCode: string
  originalAmount: number
  amountInBase: number
  balance: number
  balanceInBase: number
  status: 'active' | 'paid'
  notes?: string
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string
  createdByName?: string
}
```

Al otorgar préstamo es salida de caja; al cobrar abono es entrada de caja.

### `loan_payments/{id}`

Abonos a préstamos.

```ts
{
  loanId: string
  borrowerPhone: string
  amount: number
  currencyCode: string
  amountInBase: number
  methodName: string
  reference?: string
  createdAt: Timestamp
  createdBy: string
  createdByName?: string
}
```

### `cash_closures/{id}`

Cierres de caja diarios.

```ts
{
  closureDate: string
  report: CashClosureReport
  createdAt: Timestamp
  createdBy: string
  createdByName: string
}
```

Incluye:

- Ventas del día.
- Pagos recibidos en ventas.
- Abonos de deudas.
- Abonos de préstamos.
- Préstamos entregados.
- Cambio de moneda.
- Totales por moneda.
- Neto por moneda.

Pendiente: pagos a proveedores aún no están integrados al cierre.

## Lógica de Negocio Principal

### POS

1. Buscar producto por nombre o código de barras.
2. Agregar al carrito.
3. El producto puede venderse por unidad, peso o bulto.
4. El carrito calcula costo, ingreso, ganancia y cantidad real de stock.
5. Pago contado, mixto, multimoneda o crédito.
6. Al confirmar:
   - Crea `sales/{id}`.
   - Crea `sales/{id}/items`.
   - Crea `sales/{id}/payments`.
   - Crea `inventory_movements`.
   - Descuenta `products.stock` o `stock_categories.stock`.
   - Si hay crédito, crea/actualiza `clients` y `debts`.

Lectores de código de barras:

- El lector se trata como teclado.
- En POS, si el código escaneado coincide exactamente con `products.barcode`, el producto se selecciona automáticamente aunque el lector no envíe Enter.
- Si el lector sí envía Enter, el POS prioriza coincidencia exacta por código antes que búsqueda por nombre.
- Al registrar/editar producto, Enter dentro del campo `Código de barras` no envía el formulario; solo normaliza el código.
- Los códigos conservan ceros a la izquierda, pero se limpian espacios, tabs y saltos de línea accidentales.

### Inventario

Hay dos formas de stock:

- Producto normal: `products.stock`.
- Categoría global: `stock_categories.stock`.

Productos derivados tienen `stockCategoryId`; al vender descuentan de la categoría global.

### Entradas de mercancía

Las entradas se hacen mediante facturas de proveedor.

Una factura puede tener líneas de:

- Productos.
- Categorías globales.

Al guardar:

- Crea `purchase_invoices`.
- Suma stock.
- Crea `inventory_movements`.
- Actualiza costo del producto si aplica.
- Puede actualizar precio de venta.
- Crea proveedor si no existía.

### Proveedores

- Solo nombre obligatorio.
- Autocomplete en factura.
- Si no existe, se crea automáticamente.
- En módulo Proveedores se ve historial de facturas.
- Desde el historial se puede abrir detalle de factura.

### Ventas por usuario

Cada venta guarda:

```ts
cashierId
cashierName
```

Esto permite reportes por cajero y auditoría básica.

No existe todavía:

- Turno por usuario.
- Caja por usuario.
- Apertura/cierre por cajero.

### Fiado vs préstamo

Fiado:

- Es una venta a crédito.
- No entra dinero al vender.
- Crea deuda.
- Entra dinero cuando se cobra abono.

Préstamo:

- Es dinero que sale de caja hacia una persona.
- Sale dinero al otorgar.
- Entra dinero al cobrar abono.

### Cierre de caja

El cierre se hace por fecha, no por usuario.

Incluye:

- Ventas pagadas.
- Abonos de deudas.
- Abonos de préstamos.
- Cambios de moneda.
- Préstamos entregados.

No incluye todavía:

- Pagos/abonos a proveedores.

### Reportes

Reportes actuales:

- Ventas por periodo: hoy, semana, mes.
- Ingresos.
- Ganancia bruta.
- Margen.
- Productos más vendidos.
- Ventas por día.
- Ventas por cajero.
- Ventas por categoría.
- Cambio de moneda.
- Stock bajo/agostado.

Costos y ganancias:

- Ocultos para `cashier`.
- Visibles para `admin` y `super_admin`.

## Permisos y Menú

IDs de menú:

```txt
home
pos
currency-exchange
client-debts
sales-history
cash-closing
reports
products
categories
add-product
pending-invoices
suppliers
currencies
payments
users
settings
```

El usuario tiene:

```ts
menuPermissions: string[]
```

El sidebar se filtra según esos permisos. Si un usuario intenta entrar por URL a una sección no permitida, se redirige a la primera sección permitida.

Importante:

- `menuPermissions` controla navegación/UI y también autoriza escrituras operativas en Firestore.
- El `super_admin` siempre tiene acceso total.
- Los roles se mantienen por compatibilidad y bootstrap, pero el control fino diario debe hacerse desde permisos de menú.
- Algunas acciones destructivas o administrativas sensibles se reservan a permisos como `users` o `settings`.

## Registro de Usuarios

Flujo actual:

- `/register` crea usuarios.
- Primer usuario del sistema: `super_admin`.
- Siguientes usuarios: `cashier`.
- En Admin -> Usuarios:
  - No se crean usuarios.
  - Se editan rol, estado y menú.
  - Se envía correo de restablecimiento de clave.
  - Se puede eliminar perfil Firestore, pero eso no borra la cuenta Firebase Auth.

Si un correo ya existe en Firebase Auth aparece `auth/email-already-in-use`. Para reutilizar un correo eliminado del panel, hay que borrarlo también en Firebase Authentication.

## Pendientes Técnicos / Negocio

Prioritarios:

1. Pagos a proveedores en cierre de caja.
2. Historial real de abonos a proveedores.
3. IVA en POS o retirar `taxEnabled/taxRate`.
4. Turnos/caja por usuario si habrá varios cajeros por horario.
5. Costo promedio en categorías globales para charcutería.
6. Anular/revertir entradas ya recibidas con control formal.

Menos urgente:

- Ticket/impresión.
- Exportar reportes.
- Tests.
- Cloud Functions para lógica crítica.
- Limpieza de código legacy (`StockPage`, `MovementsPage`, `ClientsPage`, etc.).

## Servicios Clave

- `authService.ts` - login, registro y perfil.
- `userService.ts` - listar/editar usuarios.
- `saleService.ts` - crear venta, pagos, items y revertir venta.
- `purchaseInvoiceService.ts` - entradas de mercancía, proveedores, stock y pagos.
- `supplierService.ts` - CRUD proveedores.
- `productService.ts` - productos.
- `stockCategoryService.ts` - categorías globales.
- `debtService.ts` - fiado/deudas.
- `loanService.ts` - préstamos.
- `cashClosureService.ts` - cierre de caja.
- `reportService.ts` - dashboard y reportes.
- `financeService.ts` - monedas, tasas, métodos de pago.
- `currencyExchangeService.ts` - cambio de moneda.

## Reglas para Futuro Desarrollo

- No recalcular ventas históricas con precios actuales.
- Toda venta descuenta stock y crea movimiento.
- Toda entrada suma stock y crea movimiento.
- Productos derivados descuentan de `stock_categories`.
- Ventas a crédito crean deuda, no ingreso de caja.
- Abonos a deudas/préstamos sí entran en caja.
- Pagos a proveedores aún no están integrados al cierre.
- Menú por usuario controla UI y permisos de escritura en Firestore; rol queda como compatibilidad/base.
- No hardcodear credenciales.
- Mensajes UI en español.
