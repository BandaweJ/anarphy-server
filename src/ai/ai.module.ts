import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AIController } from './controllers/ai.controller';
import { OpenAIService } from './services/openai.service';

@Module({
  imports: [AuthModule],
  controllers: [AIController],
  providers: [OpenAIService],
  exports: [OpenAIService],
})
export class AIModule {}
