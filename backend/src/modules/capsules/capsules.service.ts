import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCapsuleDto, UpdateCapsuleDto } from './dto/capsule.dto';

const TITLE_LENGTH = 60;

@Injectable()
export class CapsulesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.capsule.findMany({
      where: { userId },
      orderBy: [{ openAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return { items: rows.map((row) => this.toView(row)) };
  }

  async create(userId: string, dto: CreateCapsuleDto) {
    const openAt = this.futureDate(dto.openAt);
    const capsule = await this.prisma.capsule.create({
      data: {
        userId,
        content: dto.content,
        mood: dto.mood || null,
        openAt,
      },
    });

    return this.toView(capsule);
  }

  async update(userId: string, capsuleId: string, dto: UpdateCapsuleDto) {
    await this.requireOwned(userId, capsuleId);
    const openAt = dto.openAt === undefined ? undefined : this.futureDate(dto.openAt);

    const capsule = await this.prisma.capsule.update({
      where: { id: capsuleId },
      data: {
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.mood !== undefined ? { mood: dto.mood || null } : {}),
        ...(openAt !== undefined ? { openAt } : {}),
      },
    });

    return this.toView(capsule);
  }

  async remove(userId: string, capsuleId: string) {
    const result = await this.prisma.capsule.deleteMany({ where: { id: capsuleId, userId } });
    if (result.count === 0) throw new NotFoundException('Esa cápsula no existe.');
    return { id: capsuleId };
  }

  private async requireOwned(userId: string, capsuleId: string) {
    const capsule = await this.prisma.capsule.findFirst({
      where: { id: capsuleId, userId },
      select: { id: true },
    });
    if (!capsule) throw new NotFoundException('Esa cápsula no existe.');
    return capsule;
  }

  private futureDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha de apertura no es válida.');
    }
    if (date.getTime() <= Date.now()) {
      throw new BadRequestException('Elige una fecha futura para abrir tu cápsula.');
    }
    return date;
  }

  private toView(capsule: {
    id: string;
    content: string;
    mood: string | null;
    openAt: Date;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: capsule.id,
      title:
        capsule.content.length > TITLE_LENGTH
          ? `${capsule.content.slice(0, TITLE_LENGTH).trimEnd()}…`
          : capsule.content,
      content: capsule.content,
      mood: capsule.mood,
      openAt: capsule.openAt,
      createdAt: capsule.createdAt,
      updatedAt: capsule.updatedAt,
      isOpen: capsule.openAt.getTime() <= Date.now(),
    };
  }
}
