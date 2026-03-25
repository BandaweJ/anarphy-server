import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReportReleaseTermIdBackfill1764042000000 implements MigrationInterface {
  name = 'ReportReleaseTermIdBackfill1764042000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "report_releases"
      ADD COLUMN IF NOT EXISTS "termId" integer
    `);

    // Backfill termId using legacy num/year mapping.
    await queryRunner.query(`
      UPDATE "report_releases" r
      SET "termId" = t."id"
      FROM "terms" t
      WHERE r."termId" IS NULL
        AND r."num" = t."num"
        AND r."year" = t."year"
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_report_releases_termId"
      ON "report_releases" ("termId")
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_report_releases_termId_terms_id'
        ) THEN
          ALTER TABLE "report_releases"
          ADD CONSTRAINT "FK_report_releases_termId_terms_id"
          FOREIGN KEY ("termId") REFERENCES "terms"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "report_releases"
      DROP CONSTRAINT IF EXISTS "FK_report_releases_termId_terms_id"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_report_releases_termId"
    `);

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "report_releases"
      DROP COLUMN IF EXISTS "termId"
    `);
  }
}

