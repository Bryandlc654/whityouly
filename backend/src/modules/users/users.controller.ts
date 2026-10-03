import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AccountService } from './account.service';
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
  constructor(private readonly accountService: AccountService) {}

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

  @Delete('me')
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Darse de baja (requiere contraseña y confirmación)' })
  @ApiResponse({ status: 401, description: 'La contraseña actual no es correcta.' })
  deleteAccount(@Req() req: AuthenticatedRequest, @Body() dto: DeleteAccountDto) {
    return this.accountService.deleteAccount(req.user.userId, dto);
  }
}
