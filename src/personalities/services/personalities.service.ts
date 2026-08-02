import { Injectable, NotFoundException } from '@nestjs/common';
import { PERSONALITIES } from '../config/personalities.config';
import {
  LANGUAGE_SECTION,
  RESPONSE_FORMAT_SECTION,
  buildBiasSection,
} from '../config/common-prompt-sections';
import {
  PersonalityConfig,
  PersonalitySummary,
  SpiceLevel,
} from '../personalities.types';

@Injectable()
export class PersonalitiesService {
  getAll(): PersonalitySummary[] {
    return PERSONALITIES.map(({ id, name }) => ({ id, name }));
  }

  getConfig(id: string): PersonalityConfig {
    const config = PERSONALITIES.find((personality) => personality.id === id);
    if (!config) {
      throw new NotFoundException(`Unknown personality: ${id}`);
    }
    return config;
  }

  /**
   * Arma la capa 1 del prompt (PromptStructure.md) siguiendo el esqueleto de
   * 7 secciones de Personalities.md. Las secciones 2 (idioma) y 7 (formato)
   * son compartidas; el resto viene de la config de cada personalidad. El
   * sesgo numérico (candidateWeights/talkFrequency) se agrega como addendum
   * antes del formato de respuesta — ver common-prompt-sections.ts.
   */
  getSystemPrompt(id: string, spiceLevel: SpiceLevel): string {
    const config = this.getConfig(id);
    return [
      config.identity,
      LANGUAGE_SECTION,
      config.tone,
      config.spiceModifier[spiceLevel],
      config.commentRules,
      config.readRules,
      buildBiasSection(config),
      RESPONSE_FORMAT_SECTION,
    ].join('\n\n');
  }
}
