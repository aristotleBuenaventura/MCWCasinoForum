/** Active thread translation map for language switcher (set by ThreadDetail). */
let active: Record<string, string> | null = null

export function setActiveThreadTranslations(map: Record<string, string> | null) {
  active = map
}

export function getActiveThreadTranslations() {
  return active
}
