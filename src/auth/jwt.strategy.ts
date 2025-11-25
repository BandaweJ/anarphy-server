/* eslint-disable prettier/prettier */
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { JwtPayload } from './models/jwt-payload.interface';
import { AccountsEntity } from './entities/accounts.entity';
import { Repository } from 'typeorm';
import { UnauthorizedException, Logger, NotFoundException } from '@nestjs/common';
import { ResourceByIdService } from '../resource-by-id/resource-by-id.service';
import { TeachersEntity } from '../profiles/entities/teachers.entity';
import { ParentsEntity } from '../profiles/entities/parents.entity';
import { StudentsEntity } from '../profiles/entities/students.entity';
import { ROLES } from './models/roles.enum';
import { ConfigService } from '@nestjs/config';

export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    @InjectRepository(AccountsEntity)
    private accountsRepository: Repository<AccountsEntity>,
    private resourceById: ResourceByIdService,
    private configService: ConfigService,
  ) {
    const jwtSecret = configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not configured in environment variables');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret,
      ignoreExpiration: false, // Explicitly don't ignore expiration
    });
    
    
    this.logger.log('JWT Strategy initialized successfully');
  }

  async validate(
    payload: JwtPayload,
    ): Promise<TeachersEntity | ParentsEntity | StudentsEntity | any> {
    const { username, role, id, isBootstrap } = payload;
    
    // Handle bootstrap user - skip account lookup
    if (isBootstrap) {
      return {
        id: 'bootstrap',
        role: 'admin',
        username: 'bootstrap',
        isBootstrap: true,
      };
    }

    if (!username || !role || !id) {
      this.logger.error(`JWT Strategy: Invalid payload - missing fields`, { username, role, id });
      throw new UnauthorizedException('Invalid JWT payload');
    }

    const user = await this.accountsRepository.findOne({ where: { username } });

    if (!user) {
      this.logger.error(`JWT Strategy: Account not found for username: ${username}`);
      throw new UnauthorizedException('You are not Authorised');
    }

    try {
      let profile: TeachersEntity | ParentsEntity | StudentsEntity;
      
      switch (role) {
        case ROLES.teacher:
        case ROLES.admin:
        case ROLES.hod:
        case ROLES.reception:
        case ROLES.auditor:
        case ROLES.director:
          try {
            profile = await this.resourceById.getTeacherById(id);
            if (!profile) {
              this.logger.error('JWT Strategy: Teacher profile not found', { id, role });
              throw new UnauthorizedException('Teacher profile not found');
            }
          } catch (error) {
            // getTeacherById throws NotFoundException if teacher doesn't exist
            if (error instanceof NotFoundException) {
              this.logger.error('JWT Strategy: Teacher profile not found in database', { 
                id, 
                role, 
                username,
                errorMessage: error.message 
              });
              throw new UnauthorizedException(`Teacher profile not found for ID: ${id}. Please contact administrator.`);
            }
            // Re-throw if it's a different error
            this.logger.error('JWT Strategy: Unexpected error during teacher lookup', { 
              id, 
              role, 
              username,
              error: error.message,
              errorStack: error.stack 
            });
            throw error;
          }
          break;
        case ROLES.parent:
          profile = await this.resourceById.getParentByEmail(id);
          if (!profile) {
            this.logger.error('JWT Strategy: Parent profile not found', { email: id });
            throw new UnauthorizedException('Parent profile not found');
          }
          break;
        case ROLES.student:
          profile = await this.resourceById.getStudentByStudentNumber(id);
          if (!profile) {
            this.logger.error('JWT Strategy: Student profile not found', { studentNumber: id });
            throw new UnauthorizedException('Student profile not found');
          }
          break;
        default:
          this.logger.error('JWT Strategy: Invalid role', { role });
          throw new UnauthorizedException(`Invalid user role: ${role}`);
      }
      
      // Attach the role from JWT payload to the profile
      // This ensures the role from accounts table is used (not the profile's role field)
      (profile as any).role = role;
      (profile as any).accountId = user.id;
      
      return profile;
    } catch (error) {
      this.logger.error('JWT Strategy validation error:', error);
      throw new UnauthorizedException('Failed to validate user profile');
    }
  }
}
