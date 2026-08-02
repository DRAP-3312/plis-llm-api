import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum MoveSide {
  HUMAN = 'HUMAN',
  AI = 'AI',
}

export interface OfferedCandidate {
  uci: string;
  score: number;
  tags: string[];
}

@Entity('moves')
export class Move {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  gameId!: string;

  @Column()
  ply!: number;

  @Column({ type: 'enum', enum: MoveSide })
  side!: MoveSide;

  @Column()
  uci!: string;

  @Column()
  san!: string;

  @Column('text')
  fenAfter!: string;

  @Column({ type: 'int', nullable: true })
  evalBefore!: number | null;

  @Column({ type: 'int', nullable: true })
  evalAfter!: number | null;

  @Column({ type: 'int', nullable: true })
  evalDelta!: number | null;

  @Column({ default: false })
  isCapture!: boolean;

  @Column({ default: false })
  isCheck!: boolean;

  @Column({ default: false })
  isCastle!: boolean;

  @Column({ type: 'int', nullable: true })
  msThinking!: number | null;

  @Column({ default: 0 })
  hesitations!: number;

  @Column({ default: false })
  undone!: boolean;

  // Solo se llena para jugadas de la IA.
  @Column({ type: 'jsonb', nullable: true })
  candidatesOffered!: OfferedCandidate[] | null;

  // Solo se llena para jugadas de la IA: 0, 1 o 2.
  @Column({ type: 'smallint', nullable: true })
  candidateChosen!: number | null;
}
