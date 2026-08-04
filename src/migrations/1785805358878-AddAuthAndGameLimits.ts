import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuthAndGameLimits1785805358878 implements MigrationInterface {
  name = 'AddAuthAndGameLimits1785805358878';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "auth_credentials" ("playerId" uuid NOT NULL, "username" character varying NOT NULL, "passwordHash" character varying NOT NULL, "registrationIpHash" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4120b46f2c6071dbf04e3dfa2f3" PRIMARY KEY ("playerId"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_09555f2fe4ad3a2e774d244a48" ON "auth_credentials"  ("username") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_653e382427b0626da78ecd3c95" ON "auth_credentials"  ("registrationIpHash") `,
    );

    await queryRunner.query(
      `ALTER TABLE "games" ADD "creatorIpHash" character varying NOT NULL DEFAULT 'legacy-unknown'`,
    );
    await queryRunner.query(
      `ALTER TABLE "games" ALTER COLUMN "creatorIpHash" DROP DEFAULT`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6d3b282b72f62b548528fa7bb3" ON "games"  ("creatorIpHash") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6d3b282b72f62b548528fa7bb3"`,
    );
    await queryRunner.query(`ALTER TABLE "games" DROP COLUMN "creatorIpHash"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_653e382427b0626da78ecd3c95"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_09555f2fe4ad3a2e774d244a48"`,
    );
    await queryRunner.query(`DROP TABLE "auth_credentials"`);
  }
}
