import type { Commitment, LocalData, PackTemplate } from './types'

export const DEFAULT_PACK_TEMPLATES: readonly PackTemplate[] = [
  { id: 'pack-customer', label: 'Kundenbesuch', context: 'customer', items: ['Laptop', 'Netzteil', 'Unterlagen'] },
  { id: 'pack-sport', label: 'Sport', context: 'sport', items: ['Sporttasche', 'Trinkflasche', 'Schlüssel'] },
  { id: 'pack-going-out', label: 'Ausgehen', context: 'going-out', items: ['Schlüssel', 'Persönliche Dinge', 'Jacke bei Bedarf'] },
]

export function packItems(items: readonly string[]): string[] {
  if (!Array.isArray(items)) return []
  return [...new Set(items.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
}

/** Explizit vorbereitete Items gehören zur lokalen Termininstanz, nicht zum synchronisierten Tageslog. */
export function preparedItems(commitment: Commitment, items: readonly string[]): string[] {
  const present = new Set(packItems(items))
  return packItems(commitment.preparedItems ?? []).filter((item) => present.has(item))
}

export function changePrepared(commitment: Commitment, item: string, done: boolean): Commitment {
  const prepared = new Set(packItems(commitment.preparedItems ?? []))
  if (done) prepared.add(item)
  else prepared.delete(item)
  return { ...commitment, preparedItems: [...prepared] }
}

export function packingTemplates(local: LocalData): PackTemplate[] {
  return local.packTemplates !== undefined && validPackingLocal({ packTemplates: local.packTemplates }) ? local.packTemplates : DEFAULT_PACK_TEMPLATES.map((template) => ({ ...template, items: [...template.items] }))
}

export function validPackingLocal(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const local = value as Record<string, unknown>
  const strings = (items: unknown) => Array.isArray(items) && items.length <= 100 && items.every((item) => typeof item === 'string')
  if (local.packTemplates !== undefined) {
    if (!Array.isArray(local.packTemplates) || local.packTemplates.length > 50) return false
    const ids = new Set<string>()
    if (!local.packTemplates.every((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false
      const template = value as Record<string, unknown>
      if (typeof template.id !== 'string' || !template.id || ids.has(template.id) || typeof template.label !== 'string' || !template.label.trim()
        || !['customer', 'sport', 'going-out'].includes(String(template.context)) || !strings(template.items)) return false
      ids.add(template.id)
      return true
    })) return false
  }
  return local.commitments === undefined || (Array.isArray(local.commitments) && local.commitments.every((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const commitment = value as Record<string, unknown>
    return commitment.preparedItems === undefined || strings(commitment.preparedItems)
  }))
}
