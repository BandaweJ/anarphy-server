import { MigrationInterface, QueryRunner } from 'typeorm';

export class TermTypeAndBackfillHardening1764025600000 implements MigrationInterface {
  name = 'TermTypeAndBackfillHardening1764025600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure terms table has an id sequence-backed PK and every row has id.
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "terms"
      ADD COLUMN IF NOT EXISTS "id" SERIAL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'PK_terms_id'
        ) THEN
          ALTER TABLE "terms" ADD CONSTRAINT "PK_terms_id" PRIMARY KEY ("id");
        END IF;
      END
      $$;
    `);

    // Add term type for regular vs vacation school.
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "terms"
      ADD COLUMN IF NOT EXISTS "type" character varying NOT NULL DEFAULT 'regular'
    `);

    await queryRunner.query(`
      UPDATE "terms"
      SET "type" = 'regular'
      WHERE "type" IS NULL OR "type" NOT IN ('regular', 'vacation')
    `);

    // Backfill termId in dependent tables from num/year mapping.
    await queryRunner.query(`
      UPDATE "enrol" e
      SET "termId" = t."id"
      FROM "terms" t
      WHERE (e."termId" IS NULL OR e."termId" = 0)
        AND e."num" = t."num"
        AND e."year" = t."year"
    `);

    await queryRunner.query(`
      UPDATE "reports" r
      SET "termId" = t."id"
      FROM "terms" t
      WHERE (r."termId" IS NULL OR r."termId" = 0)
        AND r."num" = t."num"
        AND r."year" = t."year"
    `);

    await queryRunner.query(`
      UPDATE "marks" m
      SET "termId" = t."id"
      FROM "terms" t
      WHERE (m."termId" IS NULL OR m."termId" = 0)
        AND m."num" = t."num"
        AND m."year" = t."year"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "terms"
      DROP COLUMN IF EXISTS "type"
    `);
  }
}

