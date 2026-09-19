import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { SearchController } from './search.controller';
import { SearchService, SearchRepository } from './search.service';
import { UnifiedSearchRepository } from './repositories/unified-search.repository';
import { UnifiedSearchService } from './unified-search.service';

@Module({
  imports: [RedisModule],
  controllers: [SearchController],
  providers: [
    SearchService,
    SearchRepository,
    UnifiedSearchRepository,
    UnifiedSearchService,
  ],
  exports: [UnifiedSearchService],
})
export class SearchModule {}
