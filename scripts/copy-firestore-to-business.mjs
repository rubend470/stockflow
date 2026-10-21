import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import {
  Bytes,
  GeoPoint,
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  writeBatch,
} from 'firebase/firestore'

const projectRoot = resolve(import.meta.dirname, '..')
const backupDirectory = resolve(projectRoot, 'backups', 'firestore')
const envPath = resolve(projectRoot, '.env')
const batchLimit = 400

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

function readArgument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function assertBusinessId(value) {
  if (!value || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(value)) {
    throw new Error('El --business-id debe usar minúsculas, números y guiones.')
  }
  return value
}

async function findLatestBackup() {
  const entries = await readdir(backupDirectory)
  const backups = entries
    .filter((name) => /^firestore-.+\.json$/.test(name) && !name.endsWith('.manifest.json'))
    .sort()
  if (!backups.length) throw new Error('No se encontró un respaldo de Firestore.')
  return resolve(backupDirectory, backups.at(-1))
}

function restoreValue(value, db, businessId) {
  if (Array.isArray(value)) return value.map((item) => restoreValue(item, db, businessId))
  if (!value || typeof value !== 'object') return value

  if (value.__type === 'timestamp') {
    return new Timestamp(Number(value.seconds), Number(value.nanoseconds))
  }
  if (value.__type === 'geopoint') {
    return new GeoPoint(Number(value.latitude), Number(value.longitude))
  }
  if (value.__type === 'bytes') {
    return Bytes.fromBase64String(String(value.base64))
  }
  if (value.__type === 'reference') {
    const sourcePath = String(value.path)
    const [rootCollection, ...rest] = sourcePath.split('/')
    if (rootCollection === 'users') return doc(db, rootCollection, ...rest)
    return doc(db, 'businesses', businessId, rootCollection, ...rest)
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, restoreValue(item, db, businessId)]),
  )
}

async function commitOperations(db, operations) {
  for (let index = 0; index < operations.length; index += batchLimit) {
    const chunk = operations.slice(index, index + batchLimit)
    const batch = writeBatch(db)
    chunk.forEach(({ reference, data }) => batch.set(reference, data))
    await batch.commit()
    console.log(`Copiadas ${Math.min(index + chunk.length, operations.length)} de ${operations.length} operaciones.`)
  }
}

const execute = process.argv.includes('--execute')
const confirmation = readArgument('--confirm')
const businessId = assertBusinessId(readArgument('--business-id'))
const businessName = readArgument('--business-name')?.trim()
const backupFile = readArgument('--backup')
  ? resolve(projectRoot, readArgument('--backup'))
  : await findLatestBackup()
const backupSource = await readFile(backupFile, 'utf8')
const backupSha256 = createHash('sha256').update(backupSource).digest('hex')
const backup = JSON.parse(backupSource)

if (!execute) {
  console.log('MODO_SIMULACION=true')
  console.log(`BACKUP=${basename(backupFile)}`)
  console.log(`BUSINESS_ID=${businessId}`)
  console.log(`SHA256=${backupSha256}`)
  console.log('No se realizó ninguna conexión ni escritura en Firebase.')
  process.exit(0)
}

if (confirmation !== `COPIAR-${businessId}`) {
  throw new Error(`Para ejecutar usa --confirm COPIAR-${businessId}.`)
}
if (!businessName) throw new Error('Para ejecutar debes indicar --business-name.')
if (!process.env.MIGRATION_EMAIL || !process.env.MIGRATION_PASSWORD) {
  throw new Error('Define MIGRATION_EMAIL y MIGRATION_PASSWORD para autenticar la copia.')
}

const env = parseEnv(await readFile(envPath, 'utf8'))
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
})
const auth = getAuth(app)
const db = getFirestore(app)

try {
  await signInWithEmailAndPassword(
    auth,
    process.env.MIGRATION_EMAIL,
    process.env.MIGRATION_PASSWORD,
  )

  const businessRef = doc(db, 'businesses', businessId)
  const existingBusiness = await getDoc(businessRef)
  if (
    existingBusiness.exists()
    && existingBusiness.data().migration?.backupSha256 !== backupSha256
  ) {
    throw new Error('La empresa destino ya existe y pertenece a otra migración.')
  }

  const signedInUserId = auth.currentUser?.uid
  const backupUsers = backup.collections.users ?? []
  if (!backupUsers.some((user) => user.id === signedInUserId)) {
    throw new Error('El usuario autenticado no está incluido en el respaldo.')
  }

  const bootstrapBatch = writeBatch(db)
  bootstrapBatch.set(
    businessRef,
    {
      name: businessName,
      status: 'active',
      migration: {
        state: 'copying',
        backupFile: basename(backupFile),
        backupSha256,
        sourceGeneratedAt: backup.generatedAt,
        startedAt: Timestamp.now(),
      },
    },
    { merge: true },
  )

  for (const backupUser of backupUsers) {
    const userRef = doc(db, 'users', backupUser.id)
    const currentUser = await getDoc(userRef)
    if (!currentUser.exists()) throw new Error(`No existe el usuario ${backupUser.id}.`)
    const businessIds = Array.isArray(currentUser.data().businessIds)
      ? currentUser.data().businessIds.map(String)
      : []
    bootstrapBatch.set(
      userRef,
      {
        businessIds: [...new Set([...businessIds, businessId])],
        currentBusinessId: currentUser.data().currentBusinessId ?? businessId,
      },
      { merge: true },
    )
  }
  await bootstrapBatch.commit()

  const operations = []
  for (const [collectionName, documents] of Object.entries(backup.collections)) {
    if (collectionName === 'users') continue
    for (const item of documents) {
      operations.push({
        reference: doc(db, 'businesses', businessId, collectionName, item.id),
        data: restoreValue(item.data, db, businessId),
      })
    }
  }

  for (const [saleId, subcollections] of Object.entries(backup.saleSubcollections ?? {})) {
    for (const subcollectionName of ['items', 'payments']) {
      for (const item of subcollections[subcollectionName] ?? []) {
        operations.push({
          reference: doc(
            db,
            'businesses',
            businessId,
            'sales',
            saleId,
            subcollectionName,
            item.id,
          ),
          data: restoreValue(item.data, db, businessId),
        })
      }
    }
  }

  await commitOperations(db, operations)

  let verifiedDocuments = 0
  for (const [collectionName, documents] of Object.entries(backup.collections)) {
    if (collectionName === 'users') continue
    const snapshot = await getDocs(collection(db, 'businesses', businessId, collectionName))
    if (snapshot.size !== documents.length) {
      throw new Error(`Conteo distinto en ${collectionName}: ${snapshot.size}/${documents.length}.`)
    }
    verifiedDocuments += snapshot.size
  }

  let verifiedSaleSubdocuments = 0
  for (const [saleId, subcollections] of Object.entries(backup.saleSubcollections ?? {})) {
    for (const subcollectionName of ['items', 'payments']) {
      const expected = (subcollections[subcollectionName] ?? []).length
      const snapshot = await getDocs(
        collection(
          db,
          'businesses',
          businessId,
          'sales',
          saleId,
          subcollectionName,
        ),
      )
      if (snapshot.size !== expected) {
        throw new Error(
          `Conteo distinto en sales/${saleId}/${subcollectionName}: ${snapshot.size}/${expected}.`,
        )
      }
      verifiedSaleSubdocuments += snapshot.size
    }
  }

  await setDoc(
    businessRef,
    {
      migration: {
        state: 'verified',
        backupFile: basename(backupFile),
        backupSha256,
        sourceGeneratedAt: backup.generatedAt,
        completedAt: Timestamp.now(),
        rootDocumentCount: verifiedDocuments,
        saleSubdocumentCount: verifiedSaleSubdocuments,
        copiedOperationCount: operations.length,
      },
    },
    { merge: true },
  )

  console.log(`MIGRATION_COMPLETE=${businessId}`)
  console.log(`COPIED_OPERATIONS=${operations.length}`)
  console.log(`VERIFIED_ROOT_DOCUMENTS=${verifiedDocuments}`)
  console.log(`VERIFIED_SALE_SUBDOCUMENTS=${verifiedSaleSubdocuments}`)
} finally {
  await signOut(auth).catch(() => undefined)
}
