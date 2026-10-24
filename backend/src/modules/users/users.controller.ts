import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountService } from './account.service';
import { DataExportService } from './data-export.service';
import {
  ChangePasswordDto,
  DeleteAccountDto,
  RequestEmailChangeDto,
  UpdatePreferencesDto,
} from './dto/account.dto';

type AuthenticatedRequest = Request & { user: { userId: string } };

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly accountService: AccountService,
    private readonly dataExportService: DataExportService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Datos de la cuenta, preferencias y consumo actual' })
  getMe(@Req() req: AuthenticatedRequest) {
    return this.accountService.getAccount(req.user.userId);
  }

  @Patch('me/preferences')
  @ApiOperation({ summary: 'Guardar preferencias de notificaciones, tema e idioma' })
  updatePreferences(@Req() req: AuthenticatedRequest, @Body() dto: UpdatePreferencesDto) {
    return this.accountService.updatePreferences(req.user.userId, dto);
  }

  @Post('me/password')
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Cambiar la contraseña (cierra todas las sesiones)' })
  @ApiResponse({ status: 401, description: 'La contraseña actual no es correcta.' })
  changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.accountService.changePassword(req.user.userId, dto);
  }

  @Post('me/email')
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Pedir cambio de correo (envía un enlace al correo nuevo)' })
  @ApiResponse({ status: 409, description: 'El correo nuevo ya está en uso.' })
  requestEmailChange(@Req() req: AuthenticatedRequest, @Body() dto: RequestEmailChangeDto) {
    return this.accountService.requestEmailChange(req.user.userId, dto);
  }

  @Get('me/export')
  @Throttle({ default: { limit: 2, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Descargar todos los datos de la cuenta en JSON' })
  async exportData(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const payload = await this.dataExportService.exportAccount(req.user.userId);
    const date = new Date().toISOString().slice(0, 10);

    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="withyouly-mis-datos-${date}.json"`,
    );
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    return payload;
  }

  @Post('me/deletion')
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Solicitar la baja reversible de la cuenta (30 días)' })
  @ApiResponse({ status: 401, description: 'La contraseña actual no es correcta.' })
  @ApiResponse({ status: 409, description: 'Ya hay una baja pendiente.' })
  requestDeletion(@Req() req: AuthenticatedRequest, @Body() dto: DeleteAccountDto) {
    return this.accountService.requestDeletion(req.user.userId, dto);
  }

  @Get('me/deletion')
  @ApiOperation({ summary: 'Consultar la solicitud de baja pendiente' })
  getDeletion(@Req() req: AuthenticatedRequest) {
    return this.accountService.getDeletion(req.user.userId);
  }

  @Post('me/deletion/cancel')
  @Throttle({ default: { limit: 5, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Cancelar la baja pendiente y reactivar la cuenta' })
  cancelDeletion(@Req() req: AuthenticatedRequest) {
    return this.accountService.cancelDeletion(req.user.userId);
  }

  @Delete('me')
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @ApiOperation({
    summary: 'Compatibilidad: inicia la baja reversible (requiere contraseña y confirmación)',
  })
  @ApiResponse({ status: 401, description: 'La contraseña actual no es correcta.' })
  deleteAccount(@Req() req: AuthenticatedRequest, @Body() dto: DeleteAccountDto) {
    return this.accountService.deleteAccount(req.user.userId, dto);
  }
}
