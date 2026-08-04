import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum GameDifficulty {
  EASY = 'EASY',
  NORMAL = 'NORMAL',
  HARD = 'HARD',
}

export enum SpiceLevel {
  MILD = 'MILD',
  NORMAL = 'NORMAL',
  CRUEL = 'CRUEL',
}

export enum PlayerColor {
  WHITE = 'WHITE',
  BLACK = 'BLACK',
}

export enum GameStatus {
  ONGOING = 'ONGOING',
  CHECKMATE = 'CHECKMATE',
  DRAW = 'DRAW',
  RESIGNED = 'RESIGNED',
}

export enum GameResult {
  WIN = 'WIN',
  LOSS = 'LOSS',
  DRAW = 'DRAW',
}

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  playerId!: string;

  @Column()
  personalityId!: string;

  @Column({ type: 'enum', enum: GameDifficulty })
  difficulty!: GameDifficulty;

  @Column({ type: 'enum', enum: SpiceLevel })
  spiceLevel!: SpiceLevel;

  @Column({ type: 'enum', enum: PlayerColor })
  playerColor!: PlayerColor;

  @Column('text')
  initialFen!: string;

  @Column('text')
  currentFen!: string;

  @Column({ default: 0 })
  ply!: number;

  @Column({
    type: 'enum',
    enum: GameStatus,
    default: GameStatus.ONGOING,
  })
  status!: GameStatus;

  @Column({ type: 'enum', enum: GameResult, nullable: true })
  result!: GameResult | null;

  @Column({ default: 0 })
  readHits!: number;

  @Column({ default: 0 })
  readAttempts!: number;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Index()
  @Column()
  creatorIpHash!: string;

  @Column({ default: false })
  pendingUndoFlag!: boolean;
}
