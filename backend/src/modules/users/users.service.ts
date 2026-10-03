import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    const email = data.email.trim().toLowerCase();

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('El correo ya está registrado');
    }

    const hash = await bcrypt.hash(data.passwordHash as string, SALT_ROUNDS);

    try {
      return await this.prisma.user.create({
        data: {
          ...data,
          email,
          passwordHash: hash,
        },
      });
    } catch (error) {
      // Condición de carrera: dos registros simultáneos con el mismo email.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updatePassword(id: string, newPassword: string): Promise<User> {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    return this.prisma.user.update({
      where: { id },
      data: { passwordHash: hash },
    });
  }

  // Permite actualizar el costo del hash de forma transparente al iniciar sesión.
  isPasswordHashOutdated(hash: string): boolean {
    try {
      return bcrypt.getRounds(hash) < SALT_ROUNDS;
    } catch {
      return false;
    }
  }

  /**
   * Actualiza la contraseña solo si el hash actual coincide (update atómico).
   * Impide el uso concurrente/repetido de un mismo token de recuperación:
   * devuelve false si el hash ya cambió (token ya usado).
   */
  async updatePasswordIfMatches(
    id: string,
    currentPasswordHash: string,
    newPassword: string,
  ): Promise<boolean> {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    const result = await this.prisma.user.updateMany({
      where: { id, passwordHash: currentPasswordHash },
      data: { passwordHash: hash },
    });

    return result.count > 0;
  }

  async markEmailAsVerified(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { isEmailVerified: true },
    });
  }
}
