import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum MemoryType {
  BLUNDER = 'BLUNDER',
  PATTERN = 'PATTERN',
  LOSS = 'LOSS',
  PLAYER_QUOTE = 'PLAYER_QUOTE',
  STREAK = 'STREAK',
}

@Entity('memories')
export class Memory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Sin relación TypeORM a propósito: playerId y gameId son de otros
  // módulos (players, games). Ver la misma nota en games/schemas/game.entity.ts.
  @Index()
  @Column('uuid')
  playerId!: string;

  @Index()
  @Column('uuid')
  gameId!: string;

  @Column({ type: 'enum', enum: MemoryType })
  type!: MemoryType;

  @Column('text')
  text!: string;

  @Column({ default: 0 })
  weight!: number;

  @Column({ default: 0 })
  useCount!: number;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
