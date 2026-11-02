import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DiaryService } from './diary.service';
import { CreateDiaryNoteDto, DiaryQueryDto, UpdateDiaryNoteDto } from './dto/diary.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Diary')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('diary')
export class DiaryController {
  constructor(private readonly diaryService: DiaryService) {}

  @Get()
  @ApiOperation({ summary: 'Historial privado combinado de notas y registros emocionales' })
  list(@Req() req: AuthenticatedRequest, @Query() query: DiaryQueryDto) {
    return this.diaryService.list(req.user.userId, query);
  }

  @Post('notes')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Crear una nota privada libre' })
  createNote(@Req() req: AuthenticatedRequest, @Body() dto: CreateDiaryNoteDto) {
    return this.diaryService.createNote(req.user.userId, dto);
  }

  @Patch('notes/:id/restore')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Restaurar una nota desde la papelera' })
  restoreNote(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.diaryService.restoreNote(req.user.userId, id);
  }

  @Patch('notes/:id')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: 'Editar una nota privada propia' })
  updateNote(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiaryNoteDto,
  ) {
    return this.diaryService.updateNote(req.user.userId, id, dto);
  }

  @Delete('notes/:id')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Mover una nota a la papelera privada' })
  removeNote(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return this.diaryService.removeNote(req.user.userId, id);
  }
}
