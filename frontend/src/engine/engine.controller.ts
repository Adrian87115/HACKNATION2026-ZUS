import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { EngineService } from './engine.service.js';
import type { BasisInput, BenefitParams, MaternityPlanInput, PregnancyBenefitInput } from './index.js';

@Controller('engine')
export class EngineController {
  constructor(private readonly engineService: EngineService) {}

  /** Kalkulator (f): podstawa wymiaru zasiłku. */
  @Post('basis')
  calculateBasis(@Body() input: BasisInput) {
    return this.engineService.calculateBasis(input);
  }

  /** Kalkulator (a): zasiłek chorobowy w ciąży / zasiłek w wysokości zasiłku macierzyńskiego. */
  @Post('pregnancy')
  calculatePregnancyBenefits(@Body() input: PregnancyBenefitInput) {
    return this.engineService.calculatePregnancyBenefits(input);
  }

  /** Kalkulatory (b)-(e): okres trwania i wysokość zasiłku macierzyńskiego. */
  @Post('maternity')
  planMaternity(@Body() input: MaternityPlanInput) {
    return this.engineService.planMaternity(input);
  }

  /** Panel administracyjny – odczyt i zmiana parametrów silnika. */
  @Get('params')
  getParams() {
    return this.engineService.getParams();
  }

  @Put('params')
  updateParams(@Body() overrides: Partial<BenefitParams>) {
    return this.engineService.updateParams(overrides);
  }

  @Post('params/reset')
  resetParams() {
    return this.engineService.resetParams();
  }
}
