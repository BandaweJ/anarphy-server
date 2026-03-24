import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HasPermissions } from 'src/auth/decorators/has-permissions.decorator';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { PERMISSIONS } from 'src/auth/models/permissions.constants';
import {
  CommentGenerationRequest,
  CommentGenerationResponse,
  OpenAIService,
} from '../services/openai.service';

@Controller('ai')
@UseGuards(AuthGuard(), PermissionsGuard)
export class AIController {
  constructor(private readonly openaiService: OpenAIService) {}

  @Post('generate-comments')
  @HasPermissions(PERMISSIONS.MARKS.ENTER)
  async generateComments(
    @Body() request: CommentGenerationRequest,
  ): Promise<CommentGenerationResponse> {
    if (typeof request.mark !== 'number' || request.mark < 0) {
      return {
        success: false,
        comments: [],
        error: 'Invalid mark provided',
      };
    }

    if (
      request.maxMark !== undefined &&
      (typeof request.maxMark !== 'number' || request.maxMark <= 0)
    ) {
      return {
        success: false,
        comments: [],
        error: 'Invalid max mark provided',
      };
    }

    return this.openaiService.generateComments(request);
  }
}
