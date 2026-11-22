import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../engine/admin-token.guard.js';
import { FeaturesService } from './features.service.js';

/** Feature switches: public read (the app adapts to them), admin-only changes. */
@Controller('features')
export class FeaturesController {
  constructor(private readonly features: FeaturesService) {}

  @Get()
  get() {
    return this.features.get();
  }

  @Get('log')
  @UseGuards(AdminTokenGuard)
  log() {
    return this.features.log();
  }

  @Put()
  @UseGuards(AdminTokenGuard)
  update(@Body() body: Record<string, unknown>) {
    return this.features.update(body ?? {});
  }
}
