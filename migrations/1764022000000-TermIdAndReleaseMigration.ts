import { MigrationInterface, QueryRunner } from 'typeorm';

export class TermIdAndReleaseMigration1764022000000 implements MigrationInterface {
  name = 'TermIdAndReleaseMigration1764022000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "terms"
      ADD COLUMN IF NOT EXISTS "id" SERIAL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'PK_terms_id'
        ) THEN
          ALTER TABLE "terms" ADD CONSTRAINT "PK_terms_id" PRIMARY KEY ("id");
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_terms_num_year_unique"
      ON "terms" ("num", "year")
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "enrol"
      ADD COLUMN IF NOT EXISTS "termId" integer
    `);

    await queryRunner.query(`
      UPDATE "enrol" e
      SET "termId" = t."id"
      FROM "terms" t
      WHERE e."termId" IS NULL
        AND e."num" = t."num"
        AND e."year" = t."year"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_enrol_termId"
      ON "enrol" ("termId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_enrol_termId_terms_id'
        ) THEN
          ALTER TABLE "enrol"
          ADD CONSTRAINT "FK_enrol_termId_terms_id"
          FOREIGN KEY ("termId") REFERENCES "terms"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "reports"
      ADD COLUMN IF NOT EXISTS "termId" integer
    `);

    await queryRunner.query(`
      UPDATE "reports" r
      SET "termId" = t."id"
      FROM "terms" t
      WHERE r."termId" IS NULL
        AND r."num" = t."num"
        AND r."year" = t."year"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reports_termId"
      ON "reports" ("termId")
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "marks"
      ADD COLUMN IF NOT EXISTS "termId" integer
    `);

    await queryRunner.query(`
      UPDATE "marks" m
      SET "termId" = t."id"
      FROM "terms" t
      WHERE m."termId" IS NULL
        AND m."num" = t."num"
        AND m."year" = t."year"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_marks_termId"
      ON "marks" ("termId")
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "marks"
      ADD COLUMN IF NOT EXISTS "termMark" integer
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "report_releases" (
        "id" SERIAL PRIMARY KEY,
        "name" character varying NOT NULL,
        "num" integer NOT NULL,
        "year" integer NOT NULL,
        "examType" character varying NOT NULL,
        "released" boolean NOT NULL DEFAULT false,
        "releasedAt" TIMESTAMP,
        "releasedBy" character varying
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_report_release_unique"
      ON "report_releases" ("name", "num", "year", "examType")
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "system_settings"
      ADD COLUMN IF NOT EXISTS "reportLetterheadPath" character varying
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE IF EXISTS "system_settings" DROP COLUMN IF EXISTS "reportLetterheadPath"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_report_release_unique"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "report_releases"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS "marks" DROP COLUMN IF EXISTS "termMark"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_marks_termId"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS "marks" DROP COLUMN IF EXISTS "termId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_reports_termId"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS "reports" DROP COLUMN IF EXISTS "termId"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS "enrol" DROP CONSTRAINT IF EXISTS "FK_enrol_termId_terms_id"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_enrol_termId"`);
    await queryRunner.query(`ALTER TABLE IF EXISTS "enrol" DROP COLUMN IF EXISTS "termId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_terms_num_year_unique"`);
  }
}

