import { SetMetadata } from '@nestjs/common';
import type { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Exige al menos uno de los roles indicados en la ruta. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
