import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { PueSessionGuard, type PueRequest } from './pue-session.guard.js';
import { PueService } from './pue.service.js';

/** Simulated mObywatel sign-in and PUE/eZUS account data (demo – fictional profiles). */
@Controller('pue')
export class PueController {
  constructor(private readonly pue: PueService) {}

  /** Demo profiles to choose from in the simulated mObywatel app. */
  @Get('personas')
  personas() {
    return this.pue.personas();
  }

  /** Simulated mObywatel confirmation → session token. */
  @Post('login')
  login(@Body() body: { personaId?: unknown }) {
    return this.pue.login(body?.personaId);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(PueSessionGuard)
  logout(@Req() req: PueRequest) {
    if (req.pueToken) this.pue.logout(req.pueToken);
  }

  /** Account data "downloaded" from ZUS systems: insurance, contribution bases, debt, e-ZLA, benefits. */
  @Get('me')
  @UseGuards(PueSessionGuard)
  me(@Req() req: PueRequest) {
    return req.pueAccount;
  }

  /** Simulated certificate on contribution arrears (important for sole traders – Art. 2a). */
  @Post('me/debt-certificate')
  @HttpCode(200)
  @UseGuards(PueSessionGuard)
  debtCertificate(@Req() req: PueRequest) {
    return this.pue.debtCertificate(req.pueAccount!);
  }
}
