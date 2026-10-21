let activeBusinessId: string | undefined

export function setActiveBusinessId(businessId?: string) {
  activeBusinessId = businessId?.trim() || undefined
}

export function getActiveBusinessId() {
  return activeBusinessId
}
