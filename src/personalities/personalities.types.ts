export type SpiceLevel = 'MILD' | 'NORMAL' | 'CRUEL';

export interface PersonalityConfig {
  id: string;
  name: string;
  /** Sección 1 del system prompt (identidad). */
  identity: string;
  /** Sección 3 del system prompt (tono y lenguaje). */
  tone: string;
  /** Sección 4, inyectada según el spiceLevel activo de la partida. */
  spiceModifier: Record<SpiceLevel, string>;
  /** Sección 5 (reglas de comentario). Distinta solo para La Máquina. */
  commentRules: string;
  /** Sección 6 (reglas de lectura). Distinta solo para La Máquina. */
  readRules: string;
  /** [peso_0, peso_1, peso_2], distribución de probabilidad, no determinismo puro. */
  candidateWeights: [number, number, number];
  /** 0.0 a 1.0. */
  talkFrequency: number;
}

export interface PersonalitySummary {
  id: string;
  name: string;
}
