import { Module } from '@nestjs/common';
import { PersonalitiesController } from './controllers/personalities.controller';
import { PersonalitiesService } from './services/personalities.service';

@Module({
  controllers: [PersonalitiesController],
  providers: [PersonalitiesService],
  exports: [PersonalitiesService],
})
export class PersonalitiesModule {}
