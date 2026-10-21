import {
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { DEFAULT_BASE_CURRENCY_CODE } from '../constants/currency'
import { tenantDocumentRef } from '../lib/tenantFirestore'
import type { AppSettings, AppSettingsFormInput } from '../types/settings'

const SETTINGS_DOC_ID = 'app'

function mapSettings(data: Record<string, unknown>): AppSettings {
  const updatedAt = data.updatedAt as { toDate?: () => Date } | string | undefined

  return {
    businessName: String(data.businessName ?? ''),
    address: String(data.address ?? ''),
    phone: String(data.phone ?? ''),
    baseCurrency: String(data.baseCurrency ?? DEFAULT_BASE_CURRENCY_CODE),
    taxEnabled: data.taxEnabled === true,
    taxRate: Number(data.taxRate ?? 0),
    lowStockAlertEnabled: data.lowStockAlertEnabled !== false,
    updatedAt:
      typeof updatedAt === 'object' && updatedAt?.toDate
        ? updatedAt.toDate().toISOString()
        : typeof updatedAt === 'string'
          ? updatedAt
          : undefined,
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  const snapshot = await getDoc(tenantDocumentRef('settings', SETTINGS_DOC_ID))

  if (!snapshot.exists()) {
    return {
      businessName: 'StockFlow',
      address: '',
      phone: '',
      baseCurrency: DEFAULT_BASE_CURRENCY_CODE,
      taxEnabled: false,
      taxRate: 0,
      lowStockAlertEnabled: true,
    }
  }

  return mapSettings(snapshot.data())
}

export async function updateAppSettings(input: AppSettingsFormInput, baseCurrency: string) {
  if (!input.businessName.trim()) {
    throw new Error('El nombre del negocio es obligatorio.')
  }

  if (input.taxRate < 0 || input.taxRate > 100) {
    throw new Error('La tasa de impuesto debe estar entre 0 y 100.')
  }

  await setDoc(
    tenantDocumentRef('settings', SETTINGS_DOC_ID),
    {
      businessName: input.businessName.trim(),
      address: input.address.trim(),
      phone: input.phone.trim(),
      baseCurrency,
      taxEnabled: input.taxEnabled,
      taxRate: input.taxRate,
      lowStockAlertEnabled: input.lowStockAlertEnabled,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
