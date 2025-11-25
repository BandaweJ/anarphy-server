import { Injectable, CanActivate, ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { ROLES } from '../models/roles.enum';
import { AccountsEntity } from '../entities/accounts.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(AccountsEntity)
    private accountsRepository: Repository<AccountsEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<ROLES[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;



    // Handle bootstrap user - they should only access teacher creation, not system settings
    if (user && (user as any).isBootstrap) {
      console.log('RolesGuard: Bootstrap user detected');
      // Bootstrap users should only be able to create teachers, not access other admin features
      // Let the normal role checking continue for other endpoints
    }

    if (!user) {
      // If roles are required but user is not found, this is an authentication issue
      // AuthGuard should have run first and populated the user
      // If AuthGuard failed (e.g., expired/invalid token), it should have already thrown an exception
      // If we reach here, it means AuthGuard didn't run or didn't throw properly
      // This should never happen if guards are applied correctly, but we handle it gracefully
      
      const authHeader = request.headers?.authorization;
      const authHeaderPresent = !!authHeader;
      
      // Log for debugging
      
      // If there's no auth header, it's definitely an auth issue
      if (!authHeaderPresent) {
        throw new UnauthorizedException('No authentication token provided. Please log in.');
      }
      
      // If there's an auth header but no user, AuthGuard should have already rejected it
      // This indicates AuthGuard may not have run, or there's a configuration issue
      // Still throw UnauthorizedException as this is an authentication failure
      throw new UnauthorizedException('Authentication failed. Please log in again.');
    }

    let userRole: string | undefined = (user as any).role;
    const accountId = (user as any).accountId;


    if (!userRole && accountId) {
      try {
        const account = await this.accountsRepository.findOne({
          where: { id: accountId },
          select: ['role'],
        });
        if (account) {
          userRole = account.role;
        }
      } catch (error) {
        console.error('RolesGuard: Error fetching account role', error);
      }
    }

    const normalizedRole = userRole?.toLowerCase().trim();

    if (!normalizedRole) {
      console.error('RolesGuard: User role not found', {
        user: { id: (user as any).id, role: (user as any).role, accountId },
        requiredRoles
      });
      throw new ForbiddenException('User role not found');
    }

    const roleEnumValues = Object.values(ROLES).map(r => r.toLowerCase());
    if (!roleEnumValues.includes(normalizedRole)) {
      console.error('RolesGuard: Invalid role value', {
        normalizedRole,
        validRoles: roleEnumValues
      });
      throw new ForbiddenException(`Invalid user role: ${normalizedRole}`);
    }


    const hasRequiredRole = requiredRoles.some(requiredRole =>
      requiredRole.toLowerCase() === normalizedRole
    );

    if (!hasRequiredRole) {
      throw new ForbiddenException(
        `Access denied. User role: ${normalizedRole}. Required roles: ${requiredRoles.join(', ')}`
      );
    }

    return true;
  }
}
