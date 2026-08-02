import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum TauntType {
  OPENING = 'OPENING',
  COMMENT = 'COMMENT',
  READ = 'READ',
  HIT = 'HIT',
  MISS = 'MISS',
  BLUNDER = 'BLUNDER',
  ENDING = 'ENDING',
}

@Entity('taunts')
export class Taunt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column('uuid')
  gameId!: string;

  @Column('uuid')
  moveId!: string;

  @Column()
  personalityId!: string;

  @Column({ type: 'enum', enum: TauntType })
  type!: TauntType;

  @Column('text')
  text!: string;

  @Column({ nullable: true })
  themeTag!: string | null;

  @Column({ nullable: true })
  model!: string | null;

  @Column({ type: 'int', nullable: true })
  tokens!: number | null;

  @Column({ type: 'int', nullable: true })
  latencyMs!: number | null;

  @Column({ default: false })
  wasFallback!: boolean;
}
