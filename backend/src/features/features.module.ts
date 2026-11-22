import { Module } from '@nestjs/common';
import { FeaturesController } from './features.controller.js';
import { FeaturesService, FeaturesStore } from './features.service.js';

@Module({
  controllers: [FeaturesController],
  providers: [FeaturesService, { provide: FeaturesStore, useFactory: () => new FeaturesStore() }],
})
export class FeaturesModule {}
