export type Match = {
  id: number
  grupo: string
  equipoA: string
  equipoB: string
  jornada: number
  fecha?: string // ISO string, se actualiza cuando el admin cargue fechas reales
}

// 72 partidos fase de grupos Mundial 2026
// Jornada: 1 = primer partido de cada equipo, 2 = segundo, 3 = tercero
// Cada grupo tiene 6 partidos: 3 de jornada 1 (los que involucran a cada equipo una vez cada par),
// pero como no tenemos fechas exactas en el Excel, asignamos jornada basada en el orden lógico
// (partidos 1-2 de cada grupo = jornada 1, 3-4 = jornada 2, 5-6 = jornada 3)

export const MATCHES: Match[] = [
  // GRUPO A
  { id: 1,  grupo: 'A', equipoA: 'México',             equipoB: 'Sudáfrica',           jornada: 1 },
  { id: 2,  grupo: 'A', equipoA: 'Rep. de Corea',      equipoB: 'Chequia',             jornada: 1 },
  { id: 3,  grupo: 'A', equipoA: 'México',             equipoB: 'Rep. de Corea',       jornada: 2 },
  { id: 4,  grupo: 'A', equipoA: 'Sudáfrica',          equipoB: 'Chequia',             jornada: 2 },
  { id: 5,  grupo: 'A', equipoA: 'México',             equipoB: 'Chequia',             jornada: 3 },
  { id: 6,  grupo: 'A', equipoA: 'Sudáfrica',          equipoB: 'Rep. de Corea',       jornada: 3 },
  // GRUPO B
  { id: 7,  grupo: 'B', equipoA: 'Canadá',             equipoB: 'Bosnia y Herzegovina',jornada: 1 },
  { id: 8,  grupo: 'B', equipoA: 'Catar',              equipoB: 'Suiza',               jornada: 1 },
  { id: 9,  grupo: 'B', equipoA: 'Canadá',             equipoB: 'Catar',               jornada: 2 },
  { id: 10, grupo: 'B', equipoA: 'Bosnia y Herzegovina',equipoB: 'Suiza',              jornada: 2 },
  { id: 11, grupo: 'B', equipoA: 'Canadá',             equipoB: 'Suiza',               jornada: 3 },
  { id: 12, grupo: 'B', equipoA: 'Bosnia y Herzegovina',equipoB: 'Catar',              jornada: 3 },
  // GRUPO C
  { id: 13, grupo: 'C', equipoA: 'Brasil',             equipoB: 'Marruecos',           jornada: 1 },
  { id: 14, grupo: 'C', equipoA: 'Haití',              equipoB: 'Escocia',             jornada: 1 },
  { id: 15, grupo: 'C', equipoA: 'Brasil',             equipoB: 'Haití',               jornada: 2 },
  { id: 16, grupo: 'C', equipoA: 'Marruecos',          equipoB: 'Escocia',             jornada: 2 },
  { id: 17, grupo: 'C', equipoA: 'Brasil',             equipoB: 'Escocia',             jornada: 3 },
  { id: 18, grupo: 'C', equipoA: 'Marruecos',          equipoB: 'Haití',               jornada: 3 },
  // GRUPO D
  { id: 19, grupo: 'D', equipoA: 'USA',                equipoB: 'Paraguay',            jornada: 1 },
  { id: 20, grupo: 'D', equipoA: 'Australia',          equipoB: 'Turquía',             jornada: 1 },
  { id: 21, grupo: 'D', equipoA: 'USA',                equipoB: 'Australia',           jornada: 2 },
  { id: 22, grupo: 'D', equipoA: 'Paraguay',           equipoB: 'Turquía',             jornada: 2 },
  { id: 23, grupo: 'D', equipoA: 'USA',                equipoB: 'Turquía',             jornada: 3 },
  { id: 24, grupo: 'D', equipoA: 'Paraguay',           equipoB: 'Australia',           jornada: 3 },
  // GRUPO E
  { id: 25, grupo: 'E', equipoA: 'Alemania',           equipoB: 'Curazao',             jornada: 1 },
  { id: 26, grupo: 'E', equipoA: 'Costa de Marfil',    equipoB: 'Ecuador',             jornada: 1 },
  { id: 27, grupo: 'E', equipoA: 'Alemania',           equipoB: 'Costa de Marfil',     jornada: 2 },
  { id: 28, grupo: 'E', equipoA: 'Curazao',            equipoB: 'Ecuador',             jornada: 2 },
  { id: 29, grupo: 'E', equipoA: 'Alemania',           equipoB: 'Ecuador',             jornada: 3 },
  { id: 30, grupo: 'E', equipoA: 'Curazao',            equipoB: 'Costa de Marfil',     jornada: 3 },
  // GRUPO F
  { id: 31, grupo: 'F', equipoA: 'Países Bajos',       equipoB: 'Japón',               jornada: 1 },
  { id: 32, grupo: 'F', equipoA: 'Suecia',             equipoB: 'Túnez',               jornada: 1 },
  { id: 33, grupo: 'F', equipoA: 'Países Bajos',       equipoB: 'Suecia',              jornada: 2 },
  { id: 34, grupo: 'F', equipoA: 'Japón',              equipoB: 'Túnez',               jornada: 2 },
  { id: 35, grupo: 'F', equipoA: 'Países Bajos',       equipoB: 'Túnez',               jornada: 3 },
  { id: 36, grupo: 'F', equipoA: 'Japón',              equipoB: 'Suecia',              jornada: 3 },
  // GRUPO G
  { id: 37, grupo: 'G', equipoA: 'Bélgica',            equipoB: 'Egipto',              jornada: 1 },
  { id: 38, grupo: 'G', equipoA: 'Irán',               equipoB: 'Nueva Zelanda',       jornada: 1 },
  { id: 39, grupo: 'G', equipoA: 'Bélgica',            equipoB: 'Irán',                jornada: 2 },
  { id: 40, grupo: 'G', equipoA: 'Egipto',             equipoB: 'Nueva Zelanda',       jornada: 2 },
  { id: 41, grupo: 'G', equipoA: 'Bélgica',            equipoB: 'Nueva Zelanda',       jornada: 3 },
  { id: 42, grupo: 'G', equipoA: 'Egipto',             equipoB: 'Irán',                jornada: 3 },
  // GRUPO H
  { id: 43, grupo: 'H', equipoA: 'España',             equipoB: 'Cabo Verde',          jornada: 1 },
  { id: 44, grupo: 'H', equipoA: 'Arabia Saudita',     equipoB: 'Uruguay',             jornada: 1 },
  { id: 45, grupo: 'H', equipoA: 'España',             equipoB: 'Arabia Saudita',      jornada: 2 },
  { id: 46, grupo: 'H', equipoA: 'Cabo Verde',         equipoB: 'Uruguay',             jornada: 2 },
  { id: 47, grupo: 'H', equipoA: 'España',             equipoB: 'Uruguay',             jornada: 3 },
  { id: 48, grupo: 'H', equipoA: 'Cabo Verde',         equipoB: 'Arabia Saudita',      jornada: 3 },
  // GRUPO I
  { id: 49, grupo: 'I', equipoA: 'Francia',            equipoB: 'Senegal',             jornada: 1 },
  { id: 50, grupo: 'I', equipoA: 'Irak',               equipoB: 'Noruega',             jornada: 1 },
  { id: 51, grupo: 'I', equipoA: 'Francia',            equipoB: 'Irak',                jornada: 2 },
  { id: 52, grupo: 'I', equipoA: 'Senegal',            equipoB: 'Noruega',             jornada: 2 },
  { id: 53, grupo: 'I', equipoA: 'Francia',            equipoB: 'Noruega',             jornada: 3 },
  { id: 54, grupo: 'I', equipoA: 'Senegal',            equipoB: 'Irak',                jornada: 3 },
  // GRUPO J
  { id: 55, grupo: 'J', equipoA: 'Argentina',          equipoB: 'Argelia',             jornada: 1 },
  { id: 56, grupo: 'J', equipoA: 'Austria',            equipoB: 'Jordania',            jornada: 1 },
  { id: 57, grupo: 'J', equipoA: 'Argentina',          equipoB: 'Austria',             jornada: 2 },
  { id: 58, grupo: 'J', equipoA: 'Argelia',            equipoB: 'Jordania',            jornada: 2 },
  { id: 59, grupo: 'J', equipoA: 'Argentina',          equipoB: 'Jordania',            jornada: 3 },
  { id: 60, grupo: 'J', equipoA: 'Argelia',            equipoB: 'Austria',             jornada: 3 },
  // GRUPO K
  { id: 61, grupo: 'K', equipoA: 'Portugal',           equipoB: 'Congo',               jornada: 1 },
  { id: 62, grupo: 'K', equipoA: 'Uzbekistán',         equipoB: 'Colombia',            jornada: 1 },
  { id: 63, grupo: 'K', equipoA: 'Portugal',           equipoB: 'Uzbekistán',          jornada: 2 },
  { id: 64, grupo: 'K', equipoA: 'Congo',              equipoB: 'Colombia',            jornada: 2 },
  { id: 65, grupo: 'K', equipoA: 'Portugal',           equipoB: 'Colombia',            jornada: 3 },
  { id: 66, grupo: 'K', equipoA: 'Congo',              equipoB: 'Uzbekistán',          jornada: 3 },
  // GRUPO L
  { id: 67, grupo: 'L', equipoA: 'Inglaterra',         equipoB: 'Croacia',             jornada: 1 },
  { id: 68, grupo: 'L', equipoA: 'Ghana',              equipoB: 'Panamá',              jornada: 1 },
  { id: 69, grupo: 'L', equipoA: 'Inglaterra',         equipoB: 'Ghana',               jornada: 2 },
  { id: 70, grupo: 'L', equipoA: 'Croacia',            equipoB: 'Panamá',              jornada: 2 },
  { id: 71, grupo: 'L', equipoA: 'Inglaterra',         equipoB: 'Panamá',              jornada: 3 },
  { id: 72, grupo: 'L', equipoA: 'Croacia',            equipoB: 'Ghana',               jornada: 3 },
]

export const GRUPOS = ['A','B','C','D','E','F','G','H','I','J','K','L']
export const JORNADAS = [1, 2, 3]

export const matchesByJornada = (jornada: number) =>
  MATCHES.filter(m => m.jornada === jornada)

export const matchesByGrupo = (grupo: string) =>
  MATCHES.filter(m => m.grupo === grupo)

export const getMatch = (id: number) =>
  MATCHES.find(m => m.id === id)

export const FASES_ELIMINATORIAS = ['16avos', 'octavos', 'cuartos', 'semis', 'tercer_lugar', 'final']
export const TODAS_JORNADAS = [1, 2, 3, 4, 5, 6, 7, 8]

export const JORNADA_LABELS: Record<number, string> = {
  1: 'Jornada 1', 2: 'Jornada 2', 3: 'Jornada 3',
  4: '16avos', 5: 'Octavos', 6: 'Cuartos', 7: 'Semis', 8: 'Final'
}
