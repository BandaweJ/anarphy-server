import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeTeacherDobNullable1732515513000 implements MigrationInterface {
    name = 'MakeTeacherDobNullable1732515513000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Make the dob column nullable in teachers table
        await queryRunner.query(`ALTER TABLE "teachers" ALTER COLUMN "dob" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revert: Make the dob column NOT NULL again
        // Note: This will fail if there are NULL values in the dob column
        await queryRunner.query(`ALTER TABLE "teachers" ALTER COLUMN "dob" SET NOT NULL`);
    }
}

