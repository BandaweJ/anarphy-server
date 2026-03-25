import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marks belong to a term via FK only; num/year are derived from `terms` when needed.
 */
export class MarksTermRelationDropNumYear1764032000000 implements MigrationInterface {
  name = 'MarksTermRelationDropNumYear1764032000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE "marks" m
      SET "termId" = t."id"
      FROM "terms" t
      WHERE (m."termId" IS NULL OR m."termId" = 0)
        AND m."num" = t."num"
        AND m."year" = t."year"
    `);

    await queryRunner.query(`
      DELETE FROM "marks" WHERE "termId" IS NULL
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_marks_termId_terms_id'
        ) THEN
          ALTER TABLE "marks"
          ADD CONSTRAINT "FK_marks_termId_terms_id"
          FOREIGN KEY ("termId") REFERENCES "terms"("id")
          ON DELETE NO ACTION ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      ALTER TABLE "marks" ALTER COLUMN "termId" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "marks" DROP COLUMN IF EXISTS "num"
    `);

    await queryRunner.query(`
      ALTER TABLE "marks" DROP COLUMN IF EXISTS "year"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "num" integer
    `);
    await queryRunner.query(`
      ALTER TABLE "marks" ADD COLUMN IF NOT EXISTS "year" integer
    `);

    await queryRunner.query(`
      UPDATE "marks" m
      SET "num" = t."num", "year" = t."year"
      FROM "terms" t
      WHERE m."termId" = t."id"
    `);

    await queryRunner.query(`
      ALTER TABLE "marks" ALTER COLUMN "num" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "marks" ALTER COLUMN "year" SET NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "marks" DROP CONSTRAINT IF EXISTS "FK_marks_termId_terms_id"
    `);

    await queryRunner.query(`
      ALTER TABLE "marks" ALTER COLUMN "termId" DROP NOT NULL
    `);
  }
}
