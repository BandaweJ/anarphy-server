import { Injectable, ExecutionContext, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class DebugJwtGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(DebugJwtGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization;
    
    this.logger.log('DebugJwtGuard: Starting authentication check', {
      hasAuthHeader: !!authHeader,
      authHeaderValue: authHeader ? `${authHeader.substring(0, 20)}...` : 'none',
      url: request.url,
      method: request.method,
      userAgent: request.headers?.['user-agent']?.substring(0, 50)
    });

    if (!authHeader) {
      this.logger.error('DebugJwtGuard: No Authorization header found');
      throw new UnauthorizedException('No authorization header');
    }

    if (!authHeader.startsWith('Bearer ')) {
      this.logger.error('DebugJwtGuard: Invalid authorization header format');
      throw new UnauthorizedException('Invalid authorization header format');
    }

    const token = authHeader.substring(7);
    this.logger.log('DebugJwtGuard: Token extracted', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 20),
      tokenEnd: token.substring(token.length - 20)
    });

    try {
      const result = await super.canActivate(context);
      this.logger.log('DebugJwtGuard: Super canActivate result', {
        result,
        hasUser: !!request.user,
        userKeys: request.user ? Object.keys(request.user) : [],
        userId: request.user ? (request.user as any).id : 'none',
        userRole: request.user ? (request.user as any).role : 'none'
      });
      return result as boolean;
    } catch (error) {
      this.logger.error('DebugJwtGuard: Authentication failed', {
        errorMessage: error.message,
        errorName: error.constructor.name,
        errorStack: error.stack?.split('\n').slice(0, 3).join('\n')
      });
      throw error;
    }
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    this.logger.log('DebugJwtGuard: handleRequest called', {
      hasError: !!err,
      errorMessage: err?.message,
      hasUser: !!user,
      hasInfo: !!info,
      infoMessage: info?.message,
      infoName: info?.name
    });

    if (err || !user) {
      this.logger.error('DebugJwtGuard: handleRequest - Authentication failed', {
        error: err?.message,
        info: info?.message || info?.name,
        user: user ? 'present' : 'missing'
      });
      throw err || new UnauthorizedException('Authentication failed in handleRequest');
    }
    
    this.logger.log('DebugJwtGuard: handleRequest - Authentication successful', {
      userId: (user as any)?.id,
      userRole: (user as any)?.role,
      userKeys: Object.keys(user)
    });
    
    return user;
  }
}
