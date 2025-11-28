import {
  Injectable,
  NotImplementedException,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ParentsEntity } from '../entities/parents.entity';
import { StudentsEntity } from '../entities/students.entity';
import { Repository } from 'typeorm';
import { CreateParentsDto } from '../dtos/createParents.dto';
import { UpdateParentDto } from '../dtos/updateParent.dto';
import { ResourceByIdService } from '../../resource-by-id/resource-by-id.service';
import { TeachersEntity } from '../entities/teachers.entity';
import { ROLES } from '../../auth/models/roles.enum';

@Injectable()
export class ParentsService {
  private readonly logger = new Logger(ParentsService.name);

  constructor(
    @InjectRepository(ParentsEntity)
    private parentsRepository: Repository<ParentsEntity>,
    @InjectRepository(StudentsEntity)
    private studentsRepository: Repository<StudentsEntity>,
    private resourceById: ResourceByIdService,
  ) {}

  /**
   * Get all students linked to a parent
   */
  async getChildrenForParent(
    email: string,
    profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ): Promise<StudentsEntity[]> {
    if (!email) {
      throw new BadRequestException('Parent email is required');
    }

    const parent = await this.resourceById.getParentByEmail(email);
    if (!parent) {
      throw new NotFoundException(`Parent with email ${email} not found`);
    }

    // Authorization: admin/director/auditor/reception can view any; parent only own; students none
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor:
      case ROLES.reception: {
        break;
      }
      case ROLES.parent: {
        if (!(profile instanceof ParentsEntity) || profile.email !== email) {
          throw new UnauthorizedException(
            'Parents can only view their own children',
          );
        }
        break;
      }
      default:
        throw new UnauthorizedException('Insufficient permissions');
    }

    return this.studentsRepository.find({
      where: { parent: { email } },
      relations: ['parent'],
      order: { surname: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Assign a student to a parent (link relationship)
   */
  async assignStudentToParent(
    email: string,
    studentNumber: string,
    profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ): Promise<StudentsEntity> {
    if (!email || !studentNumber) {
      throw new BadRequestException('Parent email and student number required');
    }

    // Only staff should assign relationships
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor:
      case ROLES.reception:
        break;
      default:
        throw new UnauthorizedException(
          'Only staff can assign students to parents',
        );
    }

    const parent = await this.resourceById.getParentByEmail(email);
    if (!parent) {
      throw new NotFoundException(`Parent with email ${email} not found`);
    }

    const student = await this.studentsRepository.findOne({
      where: { studentNumber },
      relations: ['parent'],
    });
    if (!student) {
      throw new NotFoundException(
        `Student with number ${studentNumber} not found`,
      );
    }

    student.parent = parent;
    const saved = await this.studentsRepository.save(student);
    this.logger.log(
      `Assigned student ${studentNumber} to parent ${email} by ${profile.role}`,
    );
    return saved;
  }

  async getParent(
    email: string,
    profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ): Promise<ParentsEntity> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    try {
      const parent = await this.resourceById.getParentByEmail(email);
      
      if (!parent) {
        throw new NotFoundException(`Parent with email ${email} not found`);
      }

      // Authorization checks
      switch (profile.role) {
        case ROLES.admin:
        case ROLES.director:
        case ROLES.auditor: {
          // Full access to any parent record
          return parent;
        }
        case ROLES.hod:
        case ROLES.reception:
        case ROLES.teacher: {
          // Limited access - cannot view all parent details
          throw new UnauthorizedException('Insufficient permissions to view parent details');
        }
        case ROLES.student: {
          if (profile instanceof StudentsEntity) {
            if (profile.parent?.email === parent.email) {
              // Students can view their parent's details
              return parent;
            } else {
              throw new UnauthorizedException('Can only access own parent');
            }
          } else {
            throw new UnauthorizedException('Invalid student profile');
          }
          break;
        }
        case ROLES.parent: {
          if (profile instanceof ParentsEntity) {
            if (parent.email === profile.email) {
              return parent;
            } else {
              throw new UnauthorizedException(
                'Only allowed to access your own record',
              );
            }
          }
          break;
        }
        default:
          throw new UnauthorizedException('Insufficient permissions');
      }
      
      return parent;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error getting parent ${email}:`, error);
      throw new NotFoundException(`Parent with email ${email} not found`);
    }
  }

  async getAllParents(
    profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ): Promise<ParentsEntity[]> {
    // Authorization check - Only admin, director, auditor, reception can view all parents
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor:
      case ROLES.reception: {
        // Allowed to access parent list
        break;
      }
      case ROLES.hod:
      case ROLES.teacher:
      case ROLES.parent:
      case ROLES.student: {
        throw new UnauthorizedException(
          'Only admins, directors, auditors, and reception can access parent list',
        );
      }
      default:
        throw new UnauthorizedException('Insufficient permissions');
    }

    try {
      const parents = await this.parentsRepository.find({
        relations: ['students'],
        order: { surname: 'ASC', email: 'ASC' },
      });

      this.logger.log(`Retrieved ${parents.length} parents for user ${profile.role}`);
      return parents;
    } catch (error) {
      this.logger.error('Error retrieving parents:', error);
      throw new BadRequestException('Failed to retrieve parents');
    }
  }

  async createParent(
    createParentDto: CreateParentsDto,
    profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ): Promise<ParentsEntity> {
    // Authorization check - Only admin, director, auditor, reception can create parents
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.auditor:
      case ROLES.reception: {
        // Allowed to create parents
        break;
      }
      case ROLES.hod:
      case ROLES.teacher:
      case ROLES.parent:
      case ROLES.student: {
        throw new UnauthorizedException('Only admins, directors, auditors, and reception can create parents');
      }
      default:
        throw new UnauthorizedException('Insufficient permissions');
    }

    // Validate input
    if (!createParentDto.email) {
      throw new BadRequestException('Email is required');
    }

    try {
      // Check if parent already exists
      const existingParent = await this.parentsRepository.findOne({
        where: { email: createParentDto.email },
      });

      if (existingParent) {
        throw new ConflictException(`Parent with email ${createParentDto.email} already exists`);
      }

      // Create the parent
      const parent = this.parentsRepository.create(createParentDto);
      const savedParent = await this.parentsRepository.save(parent);

      this.logger.log(`Parent created successfully: ${savedParent.email} by ${profile.role}`);
      return savedParent;
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error creating parent:`, error);
      throw new BadRequestException('Failed to create parent');
    }
  }

  async deleteParent(
    email: string,
    profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ): Promise<{ affected: number; message: string }> {
    // Authorization check - Only admins, directors, and reception can delete
    switch (profile.role) {
      case ROLES.admin:
      case ROLES.director:
      case ROLES.reception: {
        // Allowed to delete parents
        break;
      }
      case ROLES.auditor:
      case ROLES.hod:
      case ROLES.teacher:
      case ROLES.parent:
      case ROLES.student: {
        throw new UnauthorizedException('Only admins, directors, and reception can delete parents');
      }
      default:
        throw new UnauthorizedException('Insufficient permissions');
    }

    if (!email) {
      throw new BadRequestException('Email is required');
    }

    try {
      // Check if parent exists and has students
      const parent = await this.parentsRepository.findOne({
        where: { email },
        relations: ['students'],
      });

      if (!parent) {
        throw new NotFoundException(`Parent with email ${email} not found`);
      }

      // Check if parent has associated students
      if (parent.students && parent.students.length > 0) {
        throw new ConflictException(
          `Cannot delete parent ${email}. Parent has ${parent.students.length} associated student(s). Please reassign or remove students first.`
        );
      }

      // Delete the parent
      const result = await this.parentsRepository.delete(email);

      if (!result.affected) {
        throw new BadRequestException(`Failed to delete parent with email ${email}`);
      }

      this.logger.log(`Parent deleted successfully: ${email} by ${profile.role}`);
      return {
        affected: result.affected,
        message: `Parent ${email} deleted successfully`
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException || error instanceof BadRequestException || error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error(`Error deleting parent ${email}:`, error);
      throw new BadRequestException('Failed to delete parent');
    }
  }

  async updateParent(
    email: string,
    updateParentDto: UpdateParentDto,
    profile: TeachersEntity | StudentsEntity | ParentsEntity,
  ): Promise<ParentsEntity> {
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    if (!updateParentDto || Object.keys(updateParentDto).length === 0) {
      throw new BadRequestException('Update data is required');
    }

    try {
      // Get the parent (this also handles authorization)
      const parent = await this.getParent(email, profile);

      // Additional authorization for updates
      switch (profile.role) {
        case ROLES.admin:
        case ROLES.director:
        case ROLES.auditor:
        case ROLES.reception: {
          // Admin, director, auditor, reception can update any parent
          break;
        }
        case ROLES.parent: {
          // Parents can only update their own record
          if (profile instanceof ParentsEntity && profile.email !== email) {
            throw new UnauthorizedException('Can only update your own record');
          }
          // Allow parent to update their own record
          break;
        }
        case ROLES.hod:
        case ROLES.teacher:
        case ROLES.student: {
          // Other roles cannot update parent records
          throw new UnauthorizedException('Insufficient permissions to update parent records');
        }
        default:
          throw new UnauthorizedException('Insufficient permissions');
      }

      // If email is being changed, check for conflicts
      if (updateParentDto.email && updateParentDto.email !== email) {
        const existingParent = await this.parentsRepository.findOne({
          where: { email: updateParentDto.email },
        });

        if (existingParent) {
          throw new ConflictException(`Parent with email ${updateParentDto.email} already exists`);
        }
      }

      // Update the parent
      const updatedParent = await this.parentsRepository.save({
        ...parent,
        ...updateParentDto,
      });

      this.logger.log(`Parent updated successfully: ${email} by ${profile.role}`);
      return updatedParent;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof UnauthorizedException || error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Error updating parent ${email}:`, error);
      throw new BadRequestException('Failed to update parent');
    }
  }
}
