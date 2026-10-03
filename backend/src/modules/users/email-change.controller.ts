import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { ConfirmEmailChangeDto } from './dto/account.dto';

/**
 * Confirmación del cambio de correo. Va sin `JwtAuthGuard` a propósito: quien
 * llega aquí viene de un enlace del correo y puede no tener sesión abierta en
 * ese navegador. La autorización la da el token, que está firmado con un secreto
 * ligado al hash de contraseña y caduca en una hora.
 */
@ApiTags('Users')
@Controller('users')
export class EmailChangeController {
  constructor(private readonly accountService: AccountService) {}

  @Post('me/email/confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Confirmar el cambio de correo con el token recibido' })
  confirmEmailChange(@Body() dto: ConfirmEmailChangeDto) {
    return this.accountService.confirmEmailChange(dto);
  }
}
