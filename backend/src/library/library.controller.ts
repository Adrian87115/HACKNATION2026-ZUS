import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminTokenGuard } from '../engine/admin-token.guard.js';
import { LibraryService } from './library.service.js';

/** Knowledge base of official documents. Reading is public; changes need the admin token. */
@Controller('library')
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get()
  list() {
    return { topics: this.library.topics(), documents: this.library.list() };
  }

  @Get('log')
  @UseGuards(AdminTokenGuard)
  log() {
    return this.library.log();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.library.get(id);
  }

  @Post()
  @UseGuards(AdminTokenGuard)
  create(@Body() body: Record<string, unknown>) {
    return this.library.create(body ?? {});
  }

  @Post(':id/versions')
  @UseGuards(AdminTokenGuard)
  addVersion(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.library.addVersion(id, body ?? {});
  }

  @Patch(':id')
  @UseGuards(AdminTokenGuard)
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.library.update(id, body ?? {});
  }

  @Post(':id/withdraw')
  @UseGuards(AdminTokenGuard)
  withdraw(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.library.withdraw(id, body ?? {});
  }

  @Post(':id/restore')
  @UseGuards(AdminTokenGuard)
  restore(@Param('id') id: string) {
    return this.library.restore(id);
  }
}
