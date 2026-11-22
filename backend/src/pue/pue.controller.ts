import { Body, Controller, Get, HttpCode, Post, Put, Req, UseGuards } from '@nestjs/common';
import type { ApplicationInput } from './pue.applications.js';
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
    return this.pue.profile(req.pueAccount!);
  }

  /** Circumstances the user enters themselves (planned due date, change of job…) with what they mean for benefits. */
  @Put('me/circumstances')
  @UseGuards(PueSessionGuard)
  updateCircumstances(@Req() req: PueRequest, @Body() body: Record<string, unknown>) {
    return this.pue.updateCircumstances(req.pueAccount!, body);
  }

  /** Simulated certificate on contribution arrears (important for sole traders – Art. 2a). */
  @Post('me/debt-certificate')
  @HttpCode(200)
  @UseGuards(PueSessionGuard)
  debtCertificate(@Req() req: PueRequest) {
    return this.pue.debtCertificate(req.pueAccount!);
  }

  /** Applications sent from the account (leave requests to the employer, ZAM to ZUS). */
  @Get('me/applications')
  @UseGuards(PueSessionGuard)
  applications(@Req() req: PueRequest) {
    return this.pue.listApplications(req.pueAccount!);
  }

  /** Simulated e-submission of an application signed with mObywatel. */
  @Post('me/applications')
  @UseGuards(PueSessionGuard)
  submit(@Req() req: PueRequest, @Body() body: ApplicationInput) {
    return this.pue.submitApplication(req.pueAccount!, body);
  }
}
