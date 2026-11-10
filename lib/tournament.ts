export const ROUND_LABELS: Record<number, string> = {
  1: 'Cuartos · Ida',
  2: 'Cuartos · Vuelta',
  3: 'Semifinal · Ida',
  4: 'Semifinal · Vuelta',
  5: 'Final · Ida',
  6: 'Final · Vuelta',
}

export const ROUND_SHORT_LABELS: Record<number, string> = {
  1: 'CF Ida',
  2: 'CF Vuelta',
  3: 'SF Ida',
  4: 'SF Vuelta',
  5: 'Final Ida',
  6: 'Final Vuelta',
}

export const TEAM_COUNT = 8
export const MATCH_COUNT = 14
export const RESET_PHRASE = 'REINICIAR LIGUILLA'

export function normalizeTeams(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.map(value => String(value || '').trim()).filter(Boolean)
}

export function validateTeams(input: unknown, expected: number) {
  const teams = normalizeTeams(input)
  if (teams.length !== expected) return { teams, error: `Debes capturar exactamente ${expected} equipos.` }
  const unique = new Set(teams.map(team => team.toLocaleLowerCase('es-MX')))
  if (unique.size !== expected) return { teams, error: 'Los equipos no pueden repetirse.' }
  if (teams.some(team => team.length > 60)) return { teams, error: 'Cada nombre debe tener 60 caracteres o menos.' }
  return { teams, error: null }
}
