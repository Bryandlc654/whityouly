import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Roles recognized by the `Role` enum in Prisma. */
export const ROLES = ['USER', 'MODERATOR', 'ADMIN', 'SUPERADMIN'] as const;
export type RoleName = (typeof ROLES)[number];

/**
 * Estados asignables desde administración. `DELETED` no está: esa baja la hace
 * la persona titular desde su cuenta, no un tercero.
 */
export const ADMIN_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];

const ROLE_MESSAGE = `El rol debe ser uno de: ${ROLES.join(', ')}`;
const STATUS_MESSAGE = `El estado debe ser uno de: ${ADMIN_STATUSES.join(', ')}`;

export class ListUsersQueryDto {
  @ApiPropertyOptional({ description: 'Filtra por correo (parcial, sin distinguir mayúsculas).' })
  @IsOptional()
  @IsString()
  @MaxLength(254)
  search?: string;

  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsIn(ROLES as unknown as string[], { message: ROLE_MESSAGE })
  role?: RoleName;

  @ApiPropertyOptional({ enum: ADMIN_STATUSES })
  @IsOptional()
  @IsIn(ADMIN_STATUSES as unknown as string[], { message: STATUS_MESSAGE })
  status?: AdminStatus;

  @ApiPropertyOptional({ default: 20, description: 'Entre 1 y 100.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ description: 'Id del último usuario recibido; devuelve los siguientes.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;
}

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ROLES })
  @IsIn(ROLES as unknown as string[], { message: ROLE_MESSAGE })
  role: RoleName;
}

export class UpdateUserStatusDto {
  @ApiProperty({ enum: ADMIN_STATUSES })
  @IsIn(ADMIN_STATUSES as unknown as string[], { message: STATUS_MESSAGE })
  status: AdminStatus;
}
