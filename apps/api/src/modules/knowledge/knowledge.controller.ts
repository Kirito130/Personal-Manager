import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CurrentUser } from '../../auth/current-user.decorator';
import { AuthUser } from '../../auth/auth.types';
import { KnowledgeService } from './knowledge.service';

@ApiTags('knowledge')
@ApiBearerAuth()
@Controller()
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('knowledge-spaces')
  spaces(
    @CurrentUser() user: AuthUser,
    @Query('scopeType') scopeType: 'PERSONAL' | 'ORGANIZATION',
    @Query('scopeId') scopeId: string,
  ) {
    return this.knowledge.listSpaces(user.id, scopeType, scopeId);
  }

  @Post('knowledge-spaces')
  createSpace(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        scopeType: z.enum(['PERSONAL', 'ORGANIZATION']),
        scopeId: z.string().uuid(),
        name: z.string().min(1),
      })
      .parse(body);
    return this.knowledge.createSpace(user.id, dto.scopeType, dto.scopeId, dto.name);
  }

  @Post('articles')
  createArticle(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = z
      .object({
        knowledgeSpaceId: z.string().uuid(),
        title: z.string().min(1),
        body: z.string().default(''),
      })
      .parse(body);
    return this.knowledge.createArticle(user.id, dto.knowledgeSpaceId, dto.title, dto.body);
  }

  @Get('knowledge-spaces/:id/articles')
  articles(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.knowledge.listArticles(user.id, id);
  }
}
