import { createHash } from 'node:crypto'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')
const backupDirectory = resolve(projectRoot, 'backups', 'firestore')
const globalCollections = new Set(['users'])

function readArgument(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function assertBusinessId(value) {
  if (!value || !/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(value)) {
    throw new Error(
      'Usa --business-id con 3 a 64 caracteres: minúsculas, números y guiones.',
    )
  }
  return value
}

async function findLatestBackup() {
  const entries = await readdir(backupDirectory)
  const backups = entries
    .filter((name) => /^firestore-.+\.json$/.test(name) && !name.endsWith('.manifest.json'))
    .sort()

  if (backups.length === 0) {
    throw new Error('No se encontró ningún respaldo JSON en backups/firestore.')
  }

  return resolve(backupDirectory, backups.at(-1))
}

function validateDocuments(collectionName, documents) {
  if (!Array.isArray(documents)) {
    throw new Error(`La colección ${collectionName} no contiene una lista de documentos.`)
  }

  const ids = new Set()
  for (const document of documents) {
    if (!document || typeof document.id !== 'string' || !document.id) {
      throw new Error(`La colección ${collectionName} contiene un documento sin ID válido.`)
    }
    if (ids.has(document.id)) {
      throw new Error(`ID duplicado en ${collectionName}: ${document.id}`)
    }
    ids.add(document.id)
  }
}

function buildPlan(backup, businessId, backupFile, backupSha256) {
  if (!backup || backup.formatVersion !== 1 || !backup.collections) {
    throw new Error('El archivo no tiene el formato de respaldo esperado.')
  }

  const collectionPlans = []
  let tenantDocumentCount = 0
  let globalDocumentCount = 0

  for (const [collectionName, documents] of Object.entries(backup.collections)) {
    validateDocuments(collectionName, documents)
    const isGlobal = globalCollections.has(collectionName)
    const destination = isGlobal
      ? collectionName
      : `businesses/${businessId}/${collectionName}`

    collectionPlans.push({
      collection: collectionName,
      scope: isGlobal ? 'global' : 'business',
      source: collectionName,
      destination,
      documentCount: documents.length,
      action: isGlobal ? 'associate-membership' : 'copy',
    })

    if (isGlobal) globalDocumentCount += documents.length
    else tenantDocumentCount += documents.length
  }

  const saleIds = new Set((backup.collections.sales ?? []).map((sale) => sale.id))
  const saleSubcollectionPlans = []
  let saleSubdocumentCount = 0

  for (const [saleId, value] of Object.entries(backup.saleSubcollections ?? {})) {
    if (!saleIds.has(saleId)) {
      throw new Error(`Hay subcolecciones para una venta inexistente: ${saleId}`)
    }

    for (const subcollectionName of ['items', 'payments']) {
      const documents = value?.[subcollectionName] ?? []
      validateDocuments(`sales/${saleId}/${subcollectionName}`, documents)
      saleSubdocumentCount += documents.length
      saleSubcollectionPlans.push({
        saleId,
        subcollection: subcollectionName,
        source: `sales/${saleId}/${subcollectionName}`,
        destination: `businesses/${businessId}/sales/${saleId}/${subcollectionName}`,
        documentCount: documents.length,
        action: 'copy',
      })
    }
  }

  return {
    planVersion: 1,
    mode: 'dry-run',
    generatedAt: new Date().toISOString(),
    source: {
      projectId: backup.projectId,
      backupFile: basename(backupFile),
      backupGeneratedAt: backup.generatedAt,
      backupSha256,
    },
    target: {
      businessId,
      businessDocument: `businesses/${businessId}`,
    },
    safeguards: {
      writesEnabled: false,
      deletesEnabled: false,
      legacyCollectionsPreserved: true,
      existingDestinationPolicy: 'must-not-exist',
    },
    totals: {
      rootCollections: collectionPlans.length,
      tenantDocumentsToCopy: tenantDocumentCount,
      globalUsersToAssociate: globalDocumentCount,
      saleSubdocumentsToCopy: saleSubdocumentCount,
      totalPlannedOperations:
        tenantDocumentCount + globalDocumentCount + saleSubdocumentCount + 1,
    },
    collections: collectionPlans,
    saleSubcollections: saleSubcollectionPlans,
  }
}

const businessId = assertBusinessId(readArgument('--business-id'))
const requestedBackup = readArgument('--backup')
const backupFile = requestedBackup
  ? resolve(projectRoot, requestedBackup)
  : await findLatestBackup()
const backupSource = await readFile(backupFile, 'utf8')
const backupSha256 = createHash('sha256').update(backupSource).digest('hex')
const backup = JSON.parse(backupSource)
const plan = buildPlan(backup, businessId, backupFile, backupSha256)
const outputArgument = readArgument('--output')

if (outputArgument) {
  const outputFile = resolve(projectRoot, outputArgument)
  await writeFile(outputFile, `${JSON.stringify(plan, null, 2)}\n`, 'utf8')
  console.log(`PLAN_FILE=${outputFile}`)
}

console.log(JSON.stringify(plan, null, 2))
