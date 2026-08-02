import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1785698791763 implements MigrationInterface {
  name = 'InitialSchema1785698791763';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(
      `CREATE TYPE "public"."games_difficulty_enum" AS ENUM('EASY', 'NORMAL', 'HARD')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."games_spicelevel_enum" AS ENUM('MILD', 'NORMAL', 'CRUEL')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."games_playercolor_enum" AS ENUM('WHITE', 'BLACK')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."games_status_enum" AS ENUM('ONGOING', 'CHECKMATE', 'DRAW', 'RESIGNED')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."games_result_enum" AS ENUM('WIN', 'LOSS', 'DRAW')`,
    );
    await queryRunner.query(
      `CREATE TABLE "games" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "playerId" uuid NOT NULL, "personalityId" character varying NOT NULL, "difficulty" "public"."games_difficulty_enum" NOT NULL, "spiceLevel" "public"."games_spicelevel_enum" NOT NULL, "playerColor" "public"."games_playercolor_enum" NOT NULL, "initialFen" text NOT NULL, "currentFen" text NOT NULL, "ply" integer NOT NULL DEFAULT '0', "status" "public"."games_status_enum" NOT NULL DEFAULT 'ONGOING', "result" "public"."games_result_enum", "readHits" integer NOT NULL DEFAULT '0', "readAttempts" integer NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "endedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_c9b16b62917b5595af982d66337" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0f512be89f6dc60d9a843fad71" ON "games"  ("playerId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."moves_side_enum" AS ENUM('HUMAN', 'AI')`,
    );
    await queryRunner.query(
      `CREATE TABLE "moves" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gameId" uuid NOT NULL, "ply" integer NOT NULL, "side" "public"."moves_side_enum" NOT NULL, "uci" character varying NOT NULL, "san" character varying NOT NULL, "fenAfter" text NOT NULL, "evalBefore" integer, "evalAfter" integer, "evalDelta" integer, "isCapture" boolean NOT NULL DEFAULT false, "isCheck" boolean NOT NULL DEFAULT false, "isCastle" boolean NOT NULL DEFAULT false, "msThinking" integer, "hesitations" integer NOT NULL DEFAULT '0', "undone" boolean NOT NULL DEFAULT false, "candidatesOffered" jsonb, "candidateChosen" smallint, CONSTRAINT "PK_fcbf4e07f988d7d37d00e933133" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_56ec01a71f76da6fca3509439d" ON "moves"  ("gameId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "predictions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gameId" uuid NOT NULL, "targetPly" integer NOT NULL, "predictedUci" character varying NOT NULL, "alternatives" jsonb NOT NULL, "engineConfidence" integer, "declaredConfidence" character varying, "readText" text, "wasCorrect" boolean, "resolvedByMoveId" uuid, "voided" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_b92c9e4db595214b289f5e28adc" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_849972e396eec6d1d400f3ebe3" ON "predictions"  ("gameId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."taunts_type_enum" AS ENUM('OPENING', 'COMMENT', 'READ', 'HIT', 'MISS', 'BLUNDER', 'ENDING')`,
    );
    await queryRunner.query(
      `CREATE TABLE "taunts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "gameId" uuid NOT NULL, "moveId" uuid NOT NULL, "personalityId" character varying NOT NULL, "type" "public"."taunts_type_enum" NOT NULL, "text" text NOT NULL, "themeTag" character varying, "model" character varying, "tokens" integer, "latencyMs" integer, "wasFallback" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_301ba5d0ad7aff4a25203b1625c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0c3b35999837d2cea5ee389111" ON "taunts"  ("gameId") `,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."memories_type_enum" AS ENUM('BLUNDER', 'PATTERN', 'LOSS', 'PLAYER_QUOTE', 'STREAK')`,
    );
    await queryRunner.query(
      `CREATE TABLE "memories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "playerId" uuid NOT NULL, "gameId" uuid NOT NULL, "type" "public"."memories_type_enum" NOT NULL, "text" text NOT NULL, "weight" integer NOT NULL DEFAULT '0', "useCount" integer NOT NULL DEFAULT '0', "lastUsedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_aaa0692d9496fe827b0568612f8" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_32ba0ed02e05e6aadd23141b0e" ON "memories"  ("playerId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_995b00ee155a581a48a955f553" ON "memories"  ("gameId") `,
    );
    await queryRunner.query(
      `CREATE TABLE "players" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_de22b8fdeee0c33ab55ae71da3b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "player_profiles" ("playerId" uuid NOT NULL, "games" integer NOT NULL DEFAULT '0', "wins" integer NOT NULL DEFAULT '0', "losses" integer NOT NULL DEFAULT '0', "draws" integer NOT NULL DEFAULT '0', "totalPredictions" integer NOT NULL DEFAULT '0', "correctPredictions" integer NOT NULL DEFAULT '0', "avgMsPerMove" integer NOT NULL DEFAULT '0', "avgMsInCheck" integer NOT NULL DEFAULT '0', "openings" jsonb NOT NULL DEFAULT '{}', "tendencies" jsonb, "recordByPersonality" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "PK_51f792c8c303cb47fbac01c833d" PRIMARY KEY ("playerId"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "player_profiles" ADD CONSTRAINT "FK_51f792c8c303cb47fbac01c833d" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "player_profiles" DROP CONSTRAINT "FK_51f792c8c303cb47fbac01c833d"`,
    );
    await queryRunner.query(`DROP TABLE "player_profiles"`);
    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_995b00ee155a581a48a955f553"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_32ba0ed02e05e6aadd23141b0e"`,
    );
    await queryRunner.query(`DROP TABLE "memories"`);
    await queryRunner.query(`DROP TYPE "public"."memories_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0c3b35999837d2cea5ee389111"`,
    );
    await queryRunner.query(`DROP TABLE "taunts"`);
    await queryRunner.query(`DROP TYPE "public"."taunts_type_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_849972e396eec6d1d400f3ebe3"`,
    );
    await queryRunner.query(`DROP TABLE "predictions"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_56ec01a71f76da6fca3509439d"`,
    );
    await queryRunner.query(`DROP TABLE "moves"`);
    await queryRunner.query(`DROP TYPE "public"."moves_side_enum"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_0f512be89f6dc60d9a843fad71"`,
    );
    await queryRunner.query(`DROP TABLE "games"`);
    await queryRunner.query(`DROP TYPE "public"."games_result_enum"`);
    await queryRunner.query(`DROP TYPE "public"."games_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."games_playercolor_enum"`);
    await queryRunner.query(`DROP TYPE "public"."games_spicelevel_enum"`);
    await queryRunner.query(`DROP TYPE "public"."games_difficulty_enum"`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}
