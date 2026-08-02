import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export interface PredictionAlternative {
  uci: string;
  score: number;
}

@Entity('predictions')
export class Prediction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  gameId!: string;

  @Column()
  targetPly!: number;

  @Column()
  predictedUci!: string;

  @Column({ type: 'jsonb' })
  alternatives!: PredictionAlternative[];

  @Column({ type: 'int', nullable: true })
  engineConfidence!: number | null;

  @Column({ type: 'varchar', nullable: true })
  declaredConfidence!: string | null;

  @Column({ type: 'text', nullable: true })
  readText!: string | null;

  @Column({ type: 'boolean', nullable: true })
  wasCorrect!: boolean | null;

  @Column({ type: 'uuid', nullable: true })
  resolvedByMoveId!: string | null;

  // No está en ModeloDatosEndpoints.md: TurnStateMachine.md (sección undo)
  // requiere marcar una predicción como anulada (no como fallo) cuando el
  // jugador deshace la jugada que la habría resuelto.
  @Column({ default: false })
  voided!: boolean;
}
