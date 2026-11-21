import { Module } from '@nestjs/common';
import { EngineModule } from '../engine/engine.module.js';
import { PueController } from './pue.controller.js';
import { PueSessionGuard } from './pue-session.guard.js';
import { PueService } from './pue.service.js';

@Module({
  imports: [EngineModule],
  controllers: [PueController],
  providers: [PueService, PueSessionGuard],
})
export class PueModule {}
