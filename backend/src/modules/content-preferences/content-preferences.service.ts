import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthorPreferenceKindValue } from './dto/content-preferences.dto';

@Injectable()
export class ContentPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.authorPreference.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      select: { id: true, authorName: true, kind: true, createdAt: true },
    });
  }

  async create(userId: string, authorName: string, kind: AuthorPreferenceKindValue) {
    return this.prisma.authorPreference.upsert({
      where: { userId_authorName_kind: { userId, authorName, kind } },
      update: {},
      create: { userId, authorName, kind },
      select: { id: true, authorName: true, kind: true, createdAt: true },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.authorPreference.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.authorPreference.delete({ where: { id } });
    }
    return { id, removed: Boolean(existing) };
  }

  async hiddenAuthorNames(userId: string): Promise<string[]> {
    const rows = await this.prisma.authorPreference.findMany({
      where: { userId, kind: { in: ['MUTE', 'BLOCK', 'LESS'] } },
      select: { authorName: true },
    });
    return [...new Set(rows.map((row) => row.authorName))];
  }
}
