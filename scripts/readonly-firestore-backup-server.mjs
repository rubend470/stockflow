import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const backupDirectory = resolve(projectRoot, 'backups', 'firestore')
const envPath = resolve(projectRoot, '.env')
const port = 4179

function parseEnv(source) {
  return Object.fromEntries(
    source
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator), line.slice(separator + 1)]
      }),
  )
}

const env = parseEnv(await readFile(envPath, 'utf8'))
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

const collectionNames = [
  'users',
  'products',
  'stock_categories',
  'inventory_movements',
  'suppliers',
  'purchase_invoices',
  'sales',
  'clients',
  'debts',
  'debt_payments',
  'loans',
  'loan_payments',
  'cash_sessions',
  'cash_closures',
  'cash_movements',
  'expenses',
  'currencies',
  'exchange_rates',
  'currency_exchange_rates',
  'currency_exchanges',
  'payment_methods',
  'offers',
  'product_types',
  'keyboard_shortcuts',
  'settings',
]

function renderPage(staticMode = false) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Respaldo de Firestore</title>
    <style>
      body { max-width: 620px; margin: 48px auto; padding: 0 20px; font-family: system-ui, sans-serif; color: #172033; }
      form { display: grid; gap: 14px; padding: 24px; border: 1px solid #d8dee9; border-radius: 8px; }
      label { display: grid; gap: 6px; font-weight: 650; }
      input, button { min-height: 44px; padding: 8px 12px; font: inherit; }
      button { cursor: pointer; background: #176b55; color: white; border: 0; border-radius: 6px; font-weight: 700; }
      button:disabled { opacity: .55; cursor: wait; }
      pre { white-space: pre-wrap; padding: 16px; background: #f4f6f8; border-radius: 6px; }
    </style>
  </head>
  <body>
    <h1>Respaldo de solo lectura</h1>
    <p>Lee Firestore y guarda una copia local. No modifica ningún documento.</p>
    <form id="backup-form">
      <label>Correo <input id="email" type="email" autocomplete="username" required /></label>
      <label>Contraseña <input id="password" type="password" autocomplete="current-password" required /></label>
      <button id="submit" type="submit">Crear respaldo</button>
    </form>
    <pre id="status">Esperando…</pre>
    <script type="module">
      import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js'
      import { getAuth, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js'
      import { collection, getDocs, getFirestore } from 'https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js'

      const config = ${JSON.stringify(firebaseConfig)}
      const collectionNames = ${JSON.stringify(collectionNames)}
      const staticMode = ${JSON.stringify(false)}
      const app = initializeApp(config)
      const auth = getAuth(app)
      const db = getFirestore(app)
      const form = document.querySelector('#backup-form')
      const submit = document.querySelector('#submit')
      const status = document.querySelector('#status')

      function serialize(value) {
        if (value === null || value === undefined) return value ?? null
        if (Array.isArray(value)) return value.map(serialize)
        if (typeof value !== 'object') return value
        if (typeof value.toDate === 'function' && 'seconds' in value) {
          return { __type: 'timestamp', iso: value.toDate().toISOString(), seconds: value.seconds, nanoseconds: value.nanoseconds }
        }
        if (typeof value.latitude === 'number' && typeof value.longitude === 'number') {
          return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude }
        }
        if (typeof value.path === 'string' && value.firestore) {
          return { __type: 'reference', path: value.path }
        }
        if (typeof value.toBase64 === 'function') {
          return { __type: 'bytes', base64: value.toBase64() }
        }
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]))
      }

      async function readCollection(path) {
        const snapshot = await getDocs(collection(db, ...path.split('/')))
        return snapshot.docs.map((item) => ({ id: item.id, data: serialize(item.data()) }))
      }

      form.addEventListener('submit', async (event) => {
        event.preventDefault()
        submit.disabled = true
        status.textContent = 'Autenticando…'

        try {
          await signInWithEmailAndPassword(auth, document.querySelector('#email').value, document.querySelector('#password').value)
          const collections = {}

          for (const name of collectionNames) {
            status.textContent = 'Leyendo ' + name + '…'
            collections[name] = await readCollection(name)
          }

          const saleSubcollections = {}
          for (const sale of collections.sales) {
            status.textContent = 'Leyendo detalles de venta ' + sale.id + '…'
            const [items, payments] = await Promise.all([
              readCollection('sales/' + sale.id + '/items'),
              readCollection('sales/' + sale.id + '/payments'),
            ])
            saleSubcollections[sale.id] = { items, payments }
          }

          const payload = {
            formatVersion: 1,
            projectId: config.projectId,
            generatedAt: new Date().toISOString(),
            collections,
            saleSubcollections,
          }
          status.textContent = 'Guardando copia local…'
          if (staticMode) {
            const timestamp = payload.generatedAt.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
            const fileName = 'firestore-' + config.projectId + '-' + timestamp + '.json'
            const formatted = JSON.stringify(payload, null, 2) + '\\n'
            const blob = new Blob([formatted], { type: 'application/json' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = fileName
            link.click()
            URL.revokeObjectURL(link.href)
            status.textContent = 'Respaldo descargado correctamente.\\n\\nArchivo: ' + fileName
          } else {
            const response = await fetch('/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error || 'No se pudo guardar el respaldo.')
            status.textContent = 'Respaldo creado correctamente.\\n\\nArchivo: ' + result.fileName + '\\nSHA-256: ' + result.sha256 + '\\nDocumentos raíz: ' + result.rootDocumentCount + '\\nSubdocumentos de ventas: ' + result.saleSubdocumentCount
          }
        } catch (error) {
          status.textContent = 'Error: ' + (error instanceof Error ? error.message : String(error))
        } finally {
          await signOut(auth).catch(() => undefined)
          document.querySelector('#password').value = ''
          submit.disabled = false
        }
      })
    </script>
  </body>
</html>`.replace(
    `const staticMode = ${JSON.stringify(false)}`,
    `const staticMode = ${JSON.stringify(staticMode)}`,
  )
}

const server = createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(renderPage())
    return
  }

  if (request.method === 'POST' && request.url === '/save') {
    let body = ''
    for await (const chunk of request) {
      body += chunk
      if (body.length > 250_000_000) {
        response.writeHead(413, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify({ error: 'El respaldo supera el límite local de 250 MB.' }))
        return
      }
    }

    try {
      const backup = JSON.parse(body)
      if (backup.projectId !== firebaseConfig.projectId || !backup.collections || !backup.generatedAt) {
        throw new Error('Formato de respaldo inválido.')
      }

      await mkdir(backupDirectory, { recursive: true })
      const timestamp = backup.generatedAt.replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
      const fileName = `firestore-${firebaseConfig.projectId}-${timestamp}.json`
      const filePath = resolve(backupDirectory, fileName)
      const formatted = `${JSON.stringify(backup, null, 2)}\n`
      const sha256 = createHash('sha256').update(formatted).digest('hex')
      await writeFile(filePath, formatted, { encoding: 'utf8', flag: 'wx' })

      const rootDocumentCount = Object.values(backup.collections).reduce(
        (total, documents) => total + documents.length,
        0,
      )
      const saleSubdocumentCount = Object.values(backup.saleSubcollections ?? {}).reduce(
        (total, value) => total + value.items.length + value.payments.length,
        0,
      )
      const manifest = {
        fileName,
        projectId: backup.projectId,
        generatedAt: backup.generatedAt,
        sha256,
        rootDocumentCount,
        saleSubdocumentCount,
        collectionCounts: Object.fromEntries(
          Object.entries(backup.collections).map(([name, documents]) => [name, documents.length]),
        ),
      }
      await writeFile(`${filePath}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
      })

      response.writeHead(201, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify(manifest))
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
    }
    return
  }

  response.writeHead(404)
  response.end()
})

if (process.argv.includes('--write-static')) {
  const staticPath = resolve(backupDirectory, 'readonly-backup-tool.html')
  await mkdir(backupDirectory, { recursive: true })
  await writeFile(staticPath, renderPage(true), 'utf8')
  console.log(`BACKUP_FILE=${staticPath}`)
} else {
  server.listen(port, '127.0.0.1', () => {
    console.log(`BACKUP_URL=http://127.0.0.1:${port}`)
  })
}
