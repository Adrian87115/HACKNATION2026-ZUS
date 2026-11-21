import { Module } from '@nestjs/common';
import { EngineController } from './engine.controller.js';
import { EngineService } from './engine.service.js';
import { ParamsStore } from './params.store.js';

@Module({
  controllers: [EngineController],
  providers: [
    EngineService,
    // JSON file with admin parameter overrides (ENGINE_PARAMS_FILE, default ./data/engine-params.json)
    { provide: ParamsStore, useFactory: () => new ParamsStore() },
  ],
  exports: [EngineService],
})
export class EngineModule {}
