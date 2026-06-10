export interface AppSettings {
  businessName: string
  address: string
  phone: string
  baseCurrency: string
  taxEnabled: boolean
  taxRate: number
  lowStockAlertEnabled: boolean
  updatedAt?: string
}

export interface AppSettingsFormInput {
  businessName: string
  address: string
  phone: string
  taxEnabled: boolean
  taxRate: number
  lowStockAlertEnabled: boolean
}

export const emptyAppSettingsForm = (): AppSettingsFormInput => ({
  businessName: '',
  address: '',
  phone: '',
  taxEnabled: false,
  taxRate: 0,
  lowStockAlertEnabled: true,
})
