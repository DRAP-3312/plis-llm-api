import type {
  GameDifficulty,
  PlayerColor as GamesPlayerColor,
  SpiceLevel as GamesSpiceLevel,
} from '../../games/schemas/game.entity';
import type { SpiceLevel as PersonalitiesSpiceLevel } from '../../personalities/personalities.types';

// games/ y personalities/ definen los mismos valores (MILD/NORMAL/CRUEL,
// WHITE/BLACK, EASY/NORMAL/HARD) como tipos nominales distintos a propósito,
// para que ningún módulo importe entidades/tipos de otro (ver la nota en
// games/schemas/game.entity.ts). TurnService es el orquestador que sí
// necesita cruzar ambos mundos; estos casts documentan ese único punto de
// cruce en vez de esparcirlos por todo el servicio.

export function toPersonalitiesSpiceLevel(
  level: GamesSpiceLevel,
): PersonalitiesSpiceLevel {
  return level;
}

export function toPromptPlayerColor(
  color: GamesPlayerColor,
): 'WHITE' | 'BLACK' {
  return color;
}

export function toPromptDifficulty(
  difficulty: GameDifficulty,
): 'EASY' | 'NORMAL' | 'HARD' {
  return difficulty;
}
