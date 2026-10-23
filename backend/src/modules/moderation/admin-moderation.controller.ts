import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ModerationService } from './moderation.service';
import {
  CreateModerationDecisionDto,
  ListAppealsQueryDto,
  ListModerationActionsQueryDto,
  ListReportsQueryDto,
  ModerateContentDto,
  ResolveAppealDto,
  RevertModerationActionDto,
  UpdateReportDto,
} from './dto/moderation.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

/**
 * Revisión de reportes y apelaciones. Reservado a moderación y administración.
 */
@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MODERATOR', 'ADMIN')
@Controller('admin')
export class AdminModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Get('reports')
  @ApiOperation({ summary: 'Listar los reportes de la comunidad (moderación)' })
  listReports(@Query() query: ListReportsQueryDto) {
    return this.moderationService.listReports(query);
  }

  @Patch('reports/:id')
  @ApiOperation({ summary: 'Marcar un reporte en revisión o reabrir un caso' })
  @ApiResponse({ status: 404, description: 'Ese reporte no existe.' })
  updateReport(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateReportDto) {
    return this.moderationService.updateReport(req.user.userId, id, dto);
  }

  @Patch('reports/:id/decision')
  @ApiOperation({ summary: 'Aplicar una decisión de moderación con motivo (auditada)' })
  @ApiResponse({ status: 409, description: 'El reporte ya fue resuelto o el objetivo cambió.' })
  decide(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateModerationDecisionDto,
  ) {
    return this.moderationService.decideReport(req.user.userId, id, dto);
  }

  @Get('moderation/actions')
  @ApiOperation({ summary: 'Historial auditable de decisiones (paginado)' })
  listActions(@Query() query: ListModerationActionsQueryDto) {
    return this.moderationService.listActions(query);
  }

  @Patch('moderation/actions/:id/revert')
  @ApiOperation({ summary: 'Revertir una decisión y reabrir el caso' })
  @ApiResponse({ status: 409, description: 'La decisión ya fue revertida o el objetivo cambió.' })
  revertAction(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevertModerationActionDto,
  ) {
    return this.moderationService.revertAction(req.user.userId, id, dto);
  }

  @Patch('reports/:id/content')
  @ApiOperation({ summary: 'Ocultar o restaurar el contenido reportado' })
  @ApiResponse({ status: 400, description: 'Ese tipo de contenido no se puede moderar todavía.' })
  @ApiResponse({ status: 404, description: 'Ese reporte o contenido no existe.' })
  @ApiResponse({ status: 409, description: 'El contenido ya no está disponible.' })
  moderate(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ModerateContentDto,
  ) {
    return this.moderationService.moderateContent(req.user.userId, id, dto);
  }

  @Get('appeals')
  @ApiOperation({ summary: 'Listar las apelaciones de la comunidad (moderación)' })
  listAppeals(@Query() query: ListAppealsQueryDto) {
    return this.moderationService.listAppeals(query);
  }

  @Patch('appeals/:id')
  @ApiOperation({ summary: 'Resolver una apelación (aceptar restaura el contenido)' })
  @ApiResponse({ status: 404, description: 'Esa apelación no existe.' })
  @ApiResponse({ status: 409, description: 'Esa apelación ya fue resuelta.' })
  resolveAppeal(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveAppealDto,
  ) {
    return this.moderationService.resolveAppeal(req.user.userId, id, dto);
  }
}
