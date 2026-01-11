/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { CreateStudentDto } from '../dtos/createStudents.dto';
import { StudentsEntity } from '../entities/students.entity';
import { UpdateStudentDto } from '../dtos/updateStudent.dto';
import { UpdateStudentByParentDto } from '../dtos/updateStudentByParent.dto';
import { ResourceByIdService } from 'src/resource-by-id/resource-by-id.service';
import { TeachersEntity } from '../entities/teachers.entity';
import { ParentsEntity } from '../entities/parents.entity';
import { ROLES } from '../../auth/models/roles.enum';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(
    @InjectRepository(StudentsEntity)
    private studentsRepository: Repository<StudentsEntity>,
    private resourceById: ResourceByIdService,
  ) {}

  async getStudent(
    studentNumber: string,
    profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ): Promise<StudentsEntity> {
    if (!studentNumber) {
      throw new BadRequestException('Student number is required');
    }

    try {
      const student = await this.resourceById.getStudentByStudentNumber(studentNumber);
      
      if (!student) {
        throw new NotFoundException(`Student with number ${studentNumber} not found`);
      }

      // Authorization checks
      switch (profile.role) {
        case ROLES.admin:
        case ROLES.director:
        case ROLES.auditor: {
          // Full access to any student record
          return student;
        }
        case ROLES.hod:
        case ROLES.teacher:
        case ROLES.reception: {
          // Staff access to student records
          return student;
        }
        case ROLES.parent: {
          if (profile instanceof ParentsEntity) {
            // Parents can access their children's records
            if (student.parent?.email === profile.email) {
              this.logger.log(`Parent ${profile.email} accessing child ${studentNumber}`);
              return student;
            } else {
              throw new UnauthorizedException(
                'Parents can only access records of their children',
              );
            }
          } else {
            throw new UnauthorizedException('Invalid parent profile');
          }
        }
        case ROLES.student: {
          if (profile instanceof StudentsEntity) {
            // Students can access their own records
            if (profile.studentNumber === student.studentNumber) {
              return student;
            } else {
              throw new UnauthorizedException(
                'You can only access your own record',
              );
            }
          } else {
            throw new UnauthorizedException('Invalid student profile');
          }
        }
        default:
          throw new UnauthorizedException('Insufficient permissions');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error getting student ${studentNumber}:`, error);
      throw new NotFoundException(`Student with number ${studentNumber} not found`);
    }
  }

  async getAllStudents(
    profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ): Promise<StudentsEntity[]> {
    // Authorization check - Only staff can view all students
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor:
      case ROLES.hod:
      case ROLES.teacher:
      case ROLES.reception: {
        // Staff can access all students
        break;
      }
      case ROLES.parent: {
        // Parents can only see their own children
        if (profile instanceof ParentsEntity) {
          const students = await this.studentsRepository.find({
            where: { parent: { email: profile.email } },
            relations: ['parent'],
          });
          this.logger.log(`Parent ${profile.email} accessing their ${students.length} children`);
          return students;
        }
        throw new UnauthorizedException('Invalid parent profile');
      }
      case ROLES.student: {
        throw new UnauthorizedException(
          'Students cannot retrieve list of all students',
        );
      }
      default:
        throw new UnauthorizedException('Insufficient permissions');
    }

    try {
      const students = await this.studentsRepository.find({
        relations: ['parent'],
        order: { surname: 'ASC', name: 'ASC' },
      });
      this.logger.log(`Retrieved ${students.length} students for user ${profile.role}`);
      return students;
    } catch (error) {
      this.logger.error('Error retrieving students:', error);
      throw new BadRequestException('Failed to retrieve students');
    }
  }

  async createStudent(
    createStudentDto: CreateStudentDto,
    profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ): Promise<StudentsEntity> {
    // Authorization check - Only admin, director, auditor, and reception can create students
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor:
      case ROLES.reception: {
        // Allowed to create students
        break;
      }
      case ROLES.hod:
      case ROLES.teacher:
      case ROLES.parent:
      case ROLES.student: {
        throw new UnauthorizedException('Only admins, directors, auditors, and reception can add new students');
      }
      default:
        throw new UnauthorizedException('Insufficient permissions');
    }

    // Step 1: Check for an existing student with the same name and surname
    const existingStudent = await this.studentsRepository.findOne({
      where: {
        name: createStudentDto.name,
        surname: createStudentDto.surname,
      },
    });

    if (existingStudent) {
      throw new BadRequestException(
        `A student with the name '${createStudentDto.name}' and surname '${createStudentDto.surname}' already exists.`,
      );
    }

    // Step 2: Proceed with the original logic if no duplicate is found
    const newStudentNumber = await this.nextStudentNumber();

    try {
      return await this.studentsRepository.save({
        ...createStudentDto,
        studentNumber: newStudentNumber,
      });
    } catch (err) {
      // Keep the original check for the unique idnumber database error
      if (err.code === 'ER_DUP_ENTRY') {
        throw new BadRequestException(
          `Student with same ID Number already exists`,
        );
      } else {
        throw new NotImplementedException('Failed to save student' + err);
      }
    }
  }

  async deleteStudent(
    studentNumber: string,
  ): Promise<{ studentNumber: string }> {
    const student = await this.studentsRepository.findOne({
      where: {
        studentNumber,
      },
    });

    if (!student) {
      throw new NotFoundException(
        `Student with StudentNumer ${studentNumber} not found`,
      );
    }

    const result = await this.studentsRepository.delete(studentNumber);

    if (!result.affected)
      throw new NotImplementedException(
        `Student with StudentNumer ${studentNumber} not deleted`,
      );
    // return result.affected;
    return { studentNumber };
  }

  async updateStudent(
    studentNumber: string,
    updateStudentDto: UpdateStudentDto,
    profile: TeachersEntity | ParentsEntity | StudentsEntity,
  ): Promise<StudentsEntity> {
    if (!studentNumber) {
      throw new BadRequestException('Student number is required');
    }

    if (!updateStudentDto || Object.keys(updateStudentDto).length === 0) {
      throw new BadRequestException('Update data is required');
    }

    // Authorization check for full updates
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor:
      case ROLES.hod:
      case ROLES.teacher:
      case ROLES.reception: {
        // Staff can perform full updates
        break;
      }
      case ROLES.parent:
      case ROLES.student: {
        throw new UnauthorizedException('Use updateStudentByParent for parent updates or contact school administration');
      }
      default:
        throw new UnauthorizedException('Insufficient permissions');
    }

    try {
      const student = await this.getStudent(studentNumber, profile);

      const updatedStudent = await this.studentsRepository.save({
        ...student,
        ...updateStudentDto,
      });

      this.logger.log(`Student ${studentNumber} updated by ${profile.role}`);
      return updatedStudent;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating student ${studentNumber}:`, error);
      throw new BadRequestException('Failed to update student');
    }
  }

  /**
   * Update student record by parent - restricted fields only
   */
  async updateStudentByParent(
    studentNumber: string,
    updateStudentDto: UpdateStudentByParentDto,
    profile: ParentsEntity,
  ): Promise<StudentsEntity> {
    if (!studentNumber) {
      throw new BadRequestException('Student number is required');
    }

    if (!updateStudentDto || Object.keys(updateStudentDto).length === 0) {
      throw new BadRequestException('Update data is required');
    }

    // Verify parent role
    if (profile.role !== ROLES.parent) {
      throw new UnauthorizedException('This method is only for parent updates');
    }

    try {
      // Get student and verify parent relationship
      const student = await this.getStudent(studentNumber, profile);

      // Verify parent owns this student
      if (student.parent?.email !== profile.email) {
        throw new UnauthorizedException('Parents can only update their own children');
      }

      // Update only allowed fields
      const updatedStudent = await this.studentsRepository.save({
        ...student,
        ...updateStudentDto,
      });

      this.logger.log(`Student ${studentNumber} updated by parent ${profile.email}`);
      return updatedStudent;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating student ${studentNumber} by parent:`, error);
      throw new BadRequestException('Failed to update student');
    }
  }

  private async nextStudentNumber(): Promise<string> {
    /* Student Number format
     * LYYMMNNNC where
     * L is a single character representing the school name eg S for Sandon Academy
     * YY is the current year
     * MM is the current month
     * NNN is a sequential number
     * C is the check digit
     */

    // School prefix: first letter of the school name.
    // For Anarphy, we use 'A'.
    const schoolPrefix = 'A';
    const today = new Date();
    const YY = today.getFullYear().toString().substring(2);
    // Use padStart for safe two-digit month formatting
    const MM = (today.getMonth() + 1).toString().padStart(2, '0');

    // Step 1: Use a more efficient query to find the max student number for the current month.
    const searchPrefix = schoolPrefix + YY + MM;
    const lastStudent = await this.studentsRepository.findOne({
      where: {
        studentNumber: Like(`${searchPrefix}%`),
      },
      order: { studentNumber: 'DESC' },
    });

    let sequentialNumber: number;

    if (lastStudent) {
      // Step 2: Extract and safely increment the sequential number.
      // Use slice to get the last 3 digits, convert to a number, and increment.
      const lastNNN = parseInt(lastStudent.studentNumber.slice(-4, -1), 10);
      sequentialNumber = lastNNN + 1;
    } else {
      // Step 3: Start with 0 if no students exist for the current month.
      sequentialNumber = 0;
    }

    // Step 4: Pad the sequential number with leading zeros to 3 digits.
    const NNN = sequentialNumber.toString().padStart(3, '0');

    // Step 5: Assemble the student number parts.
    const rawStudentNumber = schoolPrefix + YY + MM + NNN;

    // Step 6: Calculate and append the check digit.
    const checkDigit = this.calculateCheckDigit(rawStudentNumber);

    return rawStudentNumber + checkDigit;
  }

  /**
   * Calculates a check digit using the Luhn algorithm (Mod 10).
   * @param rawStudentNumber The student number without the check digit, including the letter prefix.
   * @returns The calculated check digit (a single number).
   */
  private calculateCheckDigit(rawStudentNumber: string): number {
    let sum = 0;
    let isSecondDigit = false;

    // --- CORRECTION: Only use the numeric part of the student number for the calculation ---
    const numericPart = rawStudentNumber.substring(1);

    // Iterate through the digits of the numeric part from right to left
    for (let i = numericPart.length - 1; i >= 0; i--) {
      let digit = parseInt(numericPart.charAt(i), 10);

      if (isSecondDigit) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isSecondDigit = !isSecondDigit;
    }

    const checkDigit = (10 - (sum % 10)) % 10;
    // console.log('check digit: ', checkDigit);

    return checkDigit;
  }

  async findNewComerStudentsQueryBuilder(): Promise<StudentsEntity[]> {
    return await this.studentsRepository
      .createQueryBuilder('student')
      .leftJoinAndSelect('student.enrols', 'enrol')
      .groupBy('student.id')
      .having('COUNT(enrol.id) = 1')
      .getMany();
  }

  // In StudentsService
  async getStudentByStudentNumberWithExemption(
    studentNumber: string,
  ): Promise<StudentsEntity | null> {
    return this.studentsRepository.findOne({
      where: { studentNumber },
      relations: ['exemption'], // Ensure 'exemption' relation is loaded
    });
  }
}
