import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'
import {
  tenantCollectionPath,
  tenantDocumentPath,
  tenantSubcollectionPath,
  type TenantCollection,
} from './firestorePaths'
import { getActiveBusinessId } from './tenantScope'

function resolvePath(path: string[]) {
  const [first, ...rest] = path
  if (!first) throw new Error('La ruta de Firestore no puede estar vacía.')
  return [first, rest] as const
}

export function tenantCollectionRef(
  collectionName: TenantCollection,
  ...nestedPath: string[]
) {
  const [first, rest] = resolvePath(
    [
      ...tenantCollectionPath(collectionName, getActiveBusinessId()),
      ...nestedPath,
    ],
  )
  return collection(db, first, ...rest)
}

export function tenantDocumentRef(
  collectionName: TenantCollection,
  documentId: string,
  ...nestedPath: string[]
) {
  const [first, rest] = resolvePath(
    [
      ...tenantDocumentPath(collectionName, documentId, getActiveBusinessId()),
      ...nestedPath,
    ],
  )
  return doc(db, first, ...rest)
}

export function tenantSubcollectionRef(
  collectionName: TenantCollection,
  documentId: string,
  subcollectionName: string,
) {
  const [first, rest] = resolvePath(
    tenantSubcollectionPath(
      collectionName,
      documentId,
      subcollectionName,
      getActiveBusinessId(),
    ),
  )
  return collection(db, first, ...rest)
}
