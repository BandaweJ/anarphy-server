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
  /** Fits report cards and PDF tables; keep in sync with prompt. */
  private readonly maxWordsPerComment = 7;
  private readonly minWordsPerComment = 4;

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
        ).map((c) => this.normalizeCommentWords(c)),
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
              'You write very short subject comments for report cards and PDF tables. Each line must be a single compact phrase with no learner names.',
          },
          {
            role: 'user',
            content: this.buildPrompt(request, percentage, appliedTone),
          },
        ],
        max_tokens: 160,
        temperature: 0.8,
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new Error('No response from model');
      }

      let comments = this.parseComments(content);
      comments = this.stripLearnerNamesFromComments(comments, request.studentName);
      comments = comments.map((c) => this.normalizeCommentWords(c));
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
          comments: merged.map((c) => this.normalizeCommentWords(c)),
          source: 'openai',
          appliedTone,
        };
      }

      return {
        success: true,
        comments: comments.slice(0, 5).map((c) => this.normalizeCommentWords(c)),
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
        ).map((c) => this.normalizeCommentWords(c)),
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
Create 5 very short teacher comments for a printed report card (narrow columns).

Context:
- Mark: ${request.mark}${request.maxMark ? `/${request.maxMark}` : ''}
- Percentage: ${percentage.toFixed(1)}%
- Subject: ${subject}
- Performance band: ${performanceBand}
- Tone (auto from mark): ${tone}
${toneLine}
${className}
${examType}

Rules:
- Write exactly 5 comments as a numbered list (1. 2. 3. 4. 5.).
- Each comment: at most 7 words. Aim for about 6–7 words.
- Do not use any person's name, nickname, or initials. Do not address the learner as "you" — use neutral phrasing about performance in ${subject}.
- Be specific to the subject and the score band; avoid empty praise.
- Do not mention AI.
- Avoid slang and emojis.
    `.trim();
  }

  /** Trims to max word count for PDF/report layout. */
  private normalizeCommentWords(text: string): string {
    const words = text
      .trim()
      .split(/\s+/)
      .filter((w) => w.length > 0);
    if (words.length <= this.maxWordsPerComment) {
      const s = words.join(' ');
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
    const clipped = words.slice(0, this.maxWordsPerComment).join(' ');
    return clipped.charAt(0).toUpperCase() + clipped.slice(1);
  }

  /** Removes accidental name tokens if the client sent studentName. */
  private stripLearnerNamesFromComments(
    comments: string[],
    studentName?: string,
  ): string[] {
    if (!studentName?.trim()) {
      return comments;
    }
    const tokens = [
      ...new Set(
        studentName
          .trim()
          .split(/\s+/)
          .filter((t) => t.length > 1),
      ),
    ];
    return comments
      .map((line) => {
        let s = line;
        for (const t of tokens) {
          const esc = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          s = s.replace(new RegExp(`\\b${esc}\\b`, 'gi'), '').trim();
        }
        return s.replace(/\s+/g, ' ').replace(/^[,;]\s*|\s*[,;]$/g, '').trim();
      })
      .filter((l) => l.length > 0);
  }

  private parseComments(raw: string): string[] {
    const lines = raw
      .split('\n')
      .map((line) => line.replace(/^[-*]?\s*\d*[\).\-\s]*/, '').trim())
      .filter((line) => line.length > 0)
      .map((line) => line.replace(/\s+/g, ' ').replace(/[.;:,!?]+$/g, '').trim())
      .filter((line) => line.length > 0 && line.length <= 220)
      .filter((line) => !/[#*_`]/.test(line));

    const unique: string[] = [];
    for (const line of lines) {
      const wc = line.split(/\s+/).filter((w) => w.length > 0).length;
      if (wc < this.minWordsPerComment) {
        continue;
      }
      const clipped = this.normalizeCommentWords(line);
      const wc2 = clipped.split(/\s+/).filter((w) => w.length > 0).length;
      if (wc2 < this.minWordsPerComment) {
        continue;
      }
      if (!unique.some((x) => x.toLowerCase() === clipped.toLowerCase())) {
        unique.push(clipped);
      }
      if (unique.length >= 5) {
        break;
      }
    }
    return unique;
  }

  /** One word where possible so fallbacks stay within ~7 words for PDF columns. */
  private shortSubjectLabel(subject?: string): string {
    if (!subject?.trim()) {
      return 'subject';
    }
    return subject.trim().split(/\s+/)[0] || 'subject';
  }

  private getFallbackComments(
    mark: number,
    maxMark: number = 100,
    subject?: string,
  ): string[] {
    const percentage = (mark / maxMark) * 100;
    const s = this.shortSubjectLabel(subject);

    if (percentage >= 80) {
      return [
        `Strong ${s} work; maintain precision.`,
        `Excellent ${s} grasp; extend challenge.`,
        `High ${s} standard; refine technique.`,
        `Secure ${s} skills; sustain depth.`,
        `Top ${s} performance; deepen stretch.`,
      ];
    }

    if (percentage >= 50) {
      return [
        `Fair ${s} progress; consolidate basics.`,
        `Steady ${s} effort; improve accuracy.`,
        `Adequate ${s} standard; practice regularly.`,
        `Room to improve; focus corrections.`,
        `Developing ${s} skills; strengthen topics.`,
      ];
    }

    return [
      `Weak ${s} foundation; rebuild basics.`,
      `Low ${s} mark; revise core ideas.`,
      `Below standard; seek support early.`,
      `Needs improvement; attend and revise.`,
      `Requires practice; fix errors promptly.`,
    ];
  }
}
