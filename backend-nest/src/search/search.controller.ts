import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { Public, RateLimit } from '../common/decorators/auth.decorators';
import { successResponse } from '../common/utils/response.util';
import { SearchSuggestQueryDto, UnifiedSearchQueryDto } from './dto/search.dto';
import { SearchService } from './search.service';
import { UnifiedSearchService } from './unified-search.service';

@Controller('search')
export class SearchController {
  constructor(
    private readonly search: SearchService,
    private readonly unified: UnifiedSearchService,
  ) {}

  @Public()
  @RateLimit('api')
  @Get('trending')
  @HttpCode(HttpStatus.OK)
  async trending() {
    return successResponse(await this.search.getTrending());
  }

  @Public()
  @RateLimit('api')
  @Get()
  @HttpCode(HttpStatus.OK)
  async unifiedSearch(@Query() query: UnifiedSearchQueryDto) {
    return successResponse(await this.unified.search(query));
  }

  @Public()
  @RateLimit('api')
  @Get('suggest')
  @HttpCode(HttpStatus.OK)
  async suggest(@Query() query: SearchSuggestQueryDto) {
    return successResponse(
      await this.unified.suggest(query.q, query.limit ?? 8),
    );
  }
}
