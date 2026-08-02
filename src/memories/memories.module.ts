import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Memory } from './schemas/memory.entity';
import { MemoriesRepository } from './repositories/memories.repository';
import { MemoriesService } from './services/memories.service';

@Module({
  imports: [TypeOrmModule.forFeature([Memory])],
  providers: [MemoriesRepository, MemoriesService],
  exports: [MemoriesService, MemoriesRepository],
})
export class MemoriesModule {}
