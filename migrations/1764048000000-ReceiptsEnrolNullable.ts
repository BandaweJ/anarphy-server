import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReceiptsEnrolNullable1764048000000 implements MigrationInterface {
  name = 'ReceiptsEnrolNullable1764048000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make enrolId nullable (student can pay even if not enrolled)
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "receipts"
      ALTER COLUMN IF EXISTS "enrolId" DROP NOT NULL
    `);

    // Ensure FK exists with ON DELETE SET NULL (instead of blocking)
    await queryRunner.query(`
      DO $$
      BEGIN
        -- Drop existing FK if present (name may differ across environments)
        IF EXISTS (
          SELECT 1
          FROM pg_constraint c
          JOIN pg_class t ON t.oid = c.conrelid
          WHERE t.relname = 'receipts'
            AND c.contype = 'f'
            AND EXISTS (
              SELECT 1 FROM unnest(c.conkey) k
              JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k
              WHERE a.attname = 'enrolId'
            )
        ) THEN
          -- Try common generated name first; ignore failures
          BEGIN
            ALTER TABLE "receipts" DROP CONSTRAINT IF EXISTS "FK_receipts_enrolId";
          EXCEPTION WHEN undefined_object THEN
            NULL;
          END;
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'FK_receipts_enrolId_enrol_id'
        ) THEN
          ALTER TABLE "receipts"
          ADD CONSTRAINT "FK_receipts_enrolId_enrol_id"
          FOREIGN KEY ("enrolId") REFERENCES "enrol"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "receipts"
      DROP CONSTRAINT IF EXISTS "FK_receipts_enrolId_enrol_id"
    `);

    // Revert to NOT NULL (original behavior)
    await queryRunner.query(`
      ALTER TABLE IF EXISTS "receipts"
      ALTER COLUMN IF EXISTS "enrolId" SET NOT NULL
    `);
  }
}

