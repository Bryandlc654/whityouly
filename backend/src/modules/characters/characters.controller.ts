import { Controller, Post, Body, Get, Patch, UseGuards, Request } from '@nestjs/common';
import { CharactersService } from './characters.service';
import { CreateCharacterDto, UpdateCharacterDto } from './dto/character.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Characters')
@ApiBearerAuth() // Requiere token JWT en Swagger
@UseGuards(AuthGuard('jwt')) // Protege todas las rutas de este controlador
@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Post()
  @ApiOperation({ summary: 'Crear el personaje público para el usuario actual' })
  create(@Request() req: any, @Body() createDto: CreateCharacterDto) {
    // req.user.userId viene del JwtStrategy
    return this.charactersService.create(req.user.userId, createDto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtener el personaje del usuario autenticado' })
  getMyCharacter(@Request() req: any) {
    return this.charactersService.findByUserId(req.user.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Actualizar perfil (Avatar, bio, nombre)' })
  updateMyCharacter(@Request() req: any, @Body() updateDto: UpdateCharacterDto) {
    return this.charactersService.update(req.user.userId, updateDto);
  }
}
