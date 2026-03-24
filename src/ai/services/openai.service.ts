import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export type CommentTone = 'encouraging' | 'balanced' | 'firm';

export interface CommentGenerationRequest {
  mark: number;
  maxMark?: number;
  subject?: string;
  studentName?: string;
  className?: string;
  examType?: string;
  /** Ignored: tone is always derived from mark percentage (see appliedTone in response). */
  tone?: CommentTone;
}

export interface CommentGenerationResponse {
  comments: string[];
  success: boolean;
  error?: string;
  source?: 'openai' | 'fallback';
  /** Tone chosen automatically from the mark (percentage). */
  appliedTone?: CommentTone;
}

@Injectable()
export class OpenAIService {
  private readonly logger = new Logger(OpenAIService.name);
  private openai?: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY missing. AI comments will use fallback.');
      return;
    }

    this.openai = new OpenAI({ apiKey });
  }

  async generateComments(
    request: CommentGenerationRequest,
  ): Promise<CommentGenerationResponse> {
    const maxMark = request.maxMark || 100;
    const percentage =
      request.maxMark !== undefined && request.maxMark > 0
        ? (request.mark / request.maxMark) * 100
        : request.mark;
    const appliedTone = this.resolveToneFromPercentage(percentage);

    if (!this.openai) {
      return {
        success: true,
        comments: this.getFallbackComments(
          request.mark,
          maxMark,
          request.subject,
        ),
        source: 'fallback',
        error: 'OpenAI not configured',
        appliedTone,
      };
    }

    try {
      const model =
        this.configService.get<string>('OPENAI_COMMENT_MODEL') || 'gpt-4o-mini';

      const completion = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are an experienced secondary school teacher writing report comments. Keep comments human, specific, respectful, and suitable for Zimbabwean school report language.',
          },
          {
            role: 'user',
            content: this.buildPrompt(request, percentage, appliedTone),
          },
        ],
        max_tokens: 240,
        temperature: 0.85,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No response from model');
      }

      const comments = this.parseComments(content);
      if (comments.length < 5) {
        const fallback = this.getFallbackComments(
          request.mark,
          maxMark,
          request.subject,
        );
        const merged = [...comments];
        for (const item of fallback) {
          if (
            merged.length < 5 &&
            !merged.some((x) => x.toLowerCase() === item.toLowerCase())
          ) {
            merged.push(item);
          }
        }
        return {
          success: true,
          comments: merged,
          source: 'openai',
          appliedTone,
        };
      }

      return {
        success: true,
        comments: comments.slice(0, 5),
        source: 'openai',
        appliedTone,
      };
    } catch (error) {
      this.logger.warn(
        `AI comments failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      return {
        success: true,
        comments: this.getFallbackComments(
          request.mark,
          maxMark,
          request.subject,
        ),
        source: 'fallback',
        error: error instanceof Error ? error.message : 'unknown error',
        appliedTone,
      };
    }
  }

  /**
   * Lower marks → encouraging (supportive).
   * Mid range → balanced (constructive).
   * Strong marks → firm (high expectations, stretch).
   */
  resolveToneFromPercentage(percentage: number): CommentTone {
    if (percentage < 50) {
      return 'encouraging';
    }
    if (percentage < 75) {
      return 'balanced';
    }
    return 'firm';
  }

  private toneGuidance(tone: CommentTone): string {
    switch (tone) {
      case 'encouraging':
        return 'Use a warm, supportive tone. Acknowledge effort where possible and give clear, gentle next steps. Avoid harsh or discouraging wording.';
      case 'firm':
        return 'Use a confident, high-expectations tone suitable for strong results. Push for precision, depth, and consistent exam discipline.';
      default:
        return 'Use a balanced, professional tone. Mix honest feedback with one concrete improvement target.';
    }
  }

  private buildPrompt(
    request: CommentGenerationRequest,
    percentage: number,
    tone: CommentTone,
  ): string {
    const subject = request.subject || 'the subject';
    const student = request.studentName ? `Student: ${request.studentName}.` : '';
    const className = request.className ? `Class: ${request.className}.` : '';
    const examType = request.examType ? `Assessment: ${request.examType}.` : '';
    const toneLine = this.toneGuidance(tone);

    const performanceBand =
      percentage >= 80
        ? 'excellent'
        : percentage >= 65
        ? 'good'
        : percentage >= 50
        ? 'fair'
        : 'weak';

    return `
Create 5 realistic teacher comments for marks entry.

Context:
- Mark: ${request.mark}${request.maxMark ? `/${request.maxMark}` : ''}
- Percentage: ${percentage.toFixed(1)}%
- Subject: ${subject}
- Performance band: ${performanceBand}
- Tone (auto from mark): ${tone}
${toneLine}
${student}
${className}
${examType}

Rules:
- Write exactly 5 comments as a numbered list.
- Each comment should be 10-20 words.
- Comments must be human, specific, and aligned to the score.
- Avoid generic praise only; include a clear next step where useful.
- Do not mention AI.
- Avoid slang, emojis, or exaggerated language.
- Keep grammar clean and teacher-professional.
    `.trim();
  }

  private parseComments(raw: string): string[] {
    const lines = raw
      .split('\n')
      .map((line) => line.replace(/^[-*]?\s*\d*[\).\-\s]*/, '').trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/\s+/g, ' ').replace(/[.;:,!?]+$/g, '').trim())
      .filter((line) => line.length >= 12 && line.length <= 200)
      .filter((line) => !/[#*_`]/.test(line));

    const unique: string[] = [];
    for (const line of lines) {
      if (!unique.some((x) => x.toLowerCase() === line.toLowerCase())) {
        unique.push(line.charAt(0).toUpperCase() + line.slice(1));
      }
      if (unique.length >= 5) {
        break;
      }
    }
    return unique;
  }

  private getFallbackComments(
    mark: number,
    maxMark: number = 100,
    subject?: string,
  ): string[] {
    const percentage = (mark / maxMark) * 100;
    const topic = subject || 'the subject';

    if (percentage >= 80) {
      return [
        `Excellent command of ${topic}; keep stretching yourself with more challenging tasks each week`,
        `Strong performance in ${topic}; continue refining details to maintain this high standard`,
        `You are performing very well in ${topic}; stay consistent and support peers during class activities`,
        `Impressive understanding of ${topic}; keep practicing exam technique to protect your top marks`,
        `Great progress in ${topic}; build on this by completing extension exercises regularly`,
      ];
    }

    if (percentage >= 50) {
      return [
        `Fair performance in ${topic}; revise key concepts daily to improve confidence and accuracy`,
        `You are showing potential in ${topic}; focus on corrections and ask questions when unsure`,
        `A reasonable effort in ${topic}; more structured practice will help you improve steadily`,
        `Progress is visible in ${topic}; strengthen weak areas through regular topic-by-topic revision`,
        `You can do better in ${topic}; increase practice and pay close attention to feedback`,
      ];
    }

    return [
      `Performance in ${topic} is below expectation; begin with basics and practice consistently each day`,
      `You need stronger foundations in ${topic}; complete guided exercises and seek help early`,
      `Results in ${topic} require improvement; revise core ideas and correct every mistake carefully`,
      `Work harder in ${topic}; improve attendance, concentration, and daily revision habits`,
      `Current performance in ${topic} is low; regular support and focused practice will raise your score`,
    ];
  }
}
