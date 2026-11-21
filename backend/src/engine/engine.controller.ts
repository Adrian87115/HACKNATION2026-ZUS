import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from './admin-token.guard.js';
import { EngineService } from './engine.service.js';
import type { BasisInput, MaternityPlanInput, PregnancyBenefitInput } from '@zus/engine';

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

  /** Aktualne parametry silnika – czytane przez front przy starcie. */
  @Get('params')
  getParams() {
    return this.engineService.getParams();
  }

  /** Wartości domyślne na 2026 r. (porównanie w panelu administracyjnym). */
  @Get('params/defaults')
  getDefaults() {
    return this.engineService.getDefaults();
  }

  /* ---- Panel administracyjny (wymaga ADMIN_TOKEN) ---- */

  /** Sprawdzenie tokenu przy logowaniu do panelu. */
  @Post('admin/verify')
  @HttpCode(200)
  @UseGuards(AdminTokenGuard)
  verifyAdmin() {
    return { ok: true };
  }

  @Get('params/history')
  @UseGuards(AdminTokenGuard)
  getHistory() {
    return this.engineService.getHistory();
  }

  @Put('params')
  @UseGuards(AdminTokenGuard)
  updateParams(@Body() overrides: unknown) {
    return this.engineService.updateParams(overrides);
  }

  @Post('params/reset')
  @HttpCode(200)
  @UseGuards(AdminTokenGuard)
  resetParams() {
    return this.engineService.resetParams();
  }
}
