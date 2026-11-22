import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { LibraryStore } from './library.store.js';

@Module({
  controllers: [LibraryController],
  // JSON file with the library after admin changes (LIBRARY_FILE, default ./data/library.json)
  providers: [LibraryService, { provide: LibraryStore, useFactory: () => new LibraryStore() }],
})
export class LibraryModule {}
