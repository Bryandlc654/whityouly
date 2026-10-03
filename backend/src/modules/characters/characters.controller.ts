import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { CharactersService } from './characters.service';
import {
  CreateCharacterDto,
  UpdateCharacterDto,
  NameAvailabilityQueryDto,
} from './dto/character.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Characters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('characters')
export class CharactersController {
  constructor(private readonly charactersService: CharactersService) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiOperation({ summary: 'Crear el personaje público del usuario actual' })
  @ApiResponse({ status: 201, description: 'Personaje creado.' })
  @ApiResponse({ status: 409, description: 'La cuenta ya tiene un personaje o el nombre está en uso.' })
  create(@Req() req: AuthenticatedRequest, @Body() createDto: CreateCharacterDto) {
    return this.charactersService.create(req.user.userId, createDto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Obtener el personaje del usuario autenticado, con sus ajustes de privacidad' })
  @ApiResponse({ status: 404, description: 'El usuario todavía no ha creado su personaje.' })
  getMyCharacter(@Req() req: AuthenticatedRequest) {
    return this.charactersService.findByUserId(req.user.userId);
  }

  @Patch('me')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Actualizar el personaje (nombre, avatar, bio, privacidad)' })
  updateMyCharacter(
    @Req() req: AuthenticatedRequest,
    @Body() updateDto: UpdateCharacterDto,
  ) {
    return this.charactersService.update(req.user.userId, updateDto);
  }

  @Get('availability')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Comprobar disponibilidad de un nombre de personaje' })
  checkAvailability(@Query() query: NameAvailabilityQueryDto) {
    return this.charactersService.isNameAvailable(query.name);
  }
}
