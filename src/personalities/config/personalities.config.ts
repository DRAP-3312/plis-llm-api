import { PersonalityConfig } from '../personalities.types';
import {
  DEFAULT_COMMENT_RULES,
  DEFAULT_READ_RULES,
} from './common-prompt-sections';
import {
  MAESTRO_IDENTITY,
  MAESTRO_SPICE_MODIFIER,
  MAESTRO_TONE,
} from './prompts/maestro.prompt';
import {
  TERAPEUTA_IDENTITY,
  TERAPEUTA_SPICE_MODIFIER,
  TERAPEUTA_TONE,
} from './prompts/terapeuta.prompt';
import {
  MAQUINA_COMMENT_RULES,
  MAQUINA_IDENTITY,
  MAQUINA_READ_RULES,
  MAQUINA_SPICE_MODIFIER,
  MAQUINA_TONE,
} from './prompts/maquina.prompt';
import {
  HATER_IDENTITY,
  HATER_SPICE_MODIFIER,
  HATER_TONE,
} from './prompts/hater.prompt';

export const PERSONALITIES: readonly PersonalityConfig[] = [
  {
    id: 'maestro',
    name: 'El Maestro Decadente',
    identity: MAESTRO_IDENTITY,
    tone: MAESTRO_TONE,
    spiceModifier: MAESTRO_SPICE_MODIFIER,
    commentRules: DEFAULT_COMMENT_RULES,
    readRules: DEFAULT_READ_RULES,
    // Prefiere la más sólida posicionalmente (candidata 1) sobre la de
    // mayor evaluación si esta es una captura oportunista.
    candidateWeights: [0.3, 0.6, 0.1],
    talkFrequency: 0.65,
  },
  {
    id: 'terapeuta',
    name: 'El Terapeuta',
    identity: TERAPEUTA_IDENTITY,
    tone: TERAPEUTA_TONE,
    spiceModifier: TERAPEUTA_SPICE_MODIFIER,
    commentRules: DEFAULT_COMMENT_RULES,
    readRules: DEFAULT_READ_RULES,
    // Prefiere jugadas inesperadas o defensivas que rompan el ritmo.
    candidateWeights: [0.15, 0.45, 0.4],
    talkFrequency: 0.75,
  },
  {
    id: 'maquina',
    name: 'La Máquina',
    identity: MAQUINA_IDENTITY,
    tone: MAQUINA_TONE,
    spiceModifier: MAQUINA_SPICE_MODIFIER,
    commentRules: MAQUINA_COMMENT_RULES,
    readRules: MAQUINA_READ_RULES,
    // Siempre la de mayor evaluación, sin excepciones.
    candidateWeights: [1, 0, 0],
    talkFrequency: 0.55,
  },
  {
    id: 'hater',
    name: 'El Hater',
    identity: HATER_IDENTITY,
    tone: HATER_TONE,
    spiceModifier: HATER_SPICE_MODIFIER,
    commentRules: DEFAULT_COMMENT_RULES,
    readRules: DEFAULT_READ_RULES,
    // Ejemplo literal de Personalities.md: candidata 0 si es captura,
    // si no la 1.
    candidateWeights: [0.7, 0.25, 0.05],
    talkFrequency: 0.8,
  },
];
