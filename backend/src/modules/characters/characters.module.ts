import { Module } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';
import { PublicCharactersController } from './public-characters.controller';
import { AvatarService } from './avatar/avatar.service';
import { AvatarController } from './avatar/avatar.controller';
import { MediaCleanupService } from './avatar/media-cleanup.service';

@Module({
  // El controlador autenticado va primero para que `/me` y `/availability`
  // tengan prioridad sobre la ruta pública `/:name`.
  controllers: [CharactersController, AvatarController, PublicCharactersController],
  providers: [CharactersService, AvatarService, MediaCleanupService],
  exports: [CharactersService, AvatarService],
})
export class CharactersModule {}
