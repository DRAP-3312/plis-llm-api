import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Player } from './player.entity';

export interface OpeningsMap {
  [opening: string]: number;
}

export interface PlayerTendencies {
  defensivePct: number;
  immediateCapturePct: number;
  undoRate: number;
  blundersPerGame: number;
  avgPlyOfFirstBlunder: number;
}

export interface PersonalityRecord {
  w: number;
  l: number;
  d: number;
}

@Entity('player_profiles')
export class PlayerProfile {
  @PrimaryColumn('uuid')
  playerId!: string;

  @OneToOne(() => Player, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playerId' })
  player!: Player;

  @Column({ default: 0 })
  games!: number;

  @Column({ default: 0 })
  wins!: number;

  @Column({ default: 0 })
  losses!: number;

  @Column({ default: 0 })
  draws!: number;

  @Column({ default: 0 })
  totalPredictions!: number;

  @Column({ default: 0 })
  correctPredictions!: number;

  @Column({ default: 0 })
  avgMsPerMove!: number;

  @Column({ default: 0 })
  avgMsInCheck!: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  openings!: OpeningsMap;

  @Column({ type: 'jsonb', nullable: true })
  tendencies!: PlayerTendencies | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  recordByPersonality!: Record<string, PersonalityRecord>;
}
