import { Controller, Get } from '@nestjs/common';
import { PersonalitiesService } from '../services/personalities.service';
import { PersonalitySummary } from '../personalities.types';

@Controller('personalities')
export class PersonalitiesController {
  constructor(private readonly personalitiesService: PersonalitiesService) {}

  @Get()
  findAll(): PersonalitySummary[] {
    return this.personalitiesService.getAll();
  }
}
