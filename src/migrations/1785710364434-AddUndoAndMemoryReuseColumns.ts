import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUndoAndMemoryReuseColumns1785710364434 implements MigrationInterface {
  name = 'AddUndoAndMemoryReuseColumns1785710364434';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "games" ADD "pendingUndoFlag" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "memories" ADD "lastUsedAtGameNumber" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "memories" DROP COLUMN "lastUsedAtGameNumber"`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" DROP COLUMN "pendingUndoFlag"`,
    );
  }
}
