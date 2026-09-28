import { Module } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { CharactersController } from './characters.controller';

@Module({
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService], // Por si Stories necesita buscar personajes luego
})
export class CharactersModule {}
