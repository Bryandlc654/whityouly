import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupportTicketStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SUPPORT_BODY_MAX_LENGTH,
  SUPPORT_BODY_MIN_LENGTH,
  type CreateSupportTicketDto,
  type ListMySupportTicketsQueryDto,
  type SupportCategory,
  type SupportStatus,
} from './dto/support.dto';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
// Un límite de casos abiertos evita que una cuenta inunde la bandeja. No
// sustituye al rate limit: ambos protegen dimensiones distintas del abuso.
const MAX_OPEN_TICKETS = 10;

const SUPPORT_SELECT = {
  id: true,
  category: true,
  body: true,
  status: true,
  resolutionNote: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
} as const;

export interface SupportTicketView {
  id: string;
  category: SupportCategory;
  body: string;
  status: SupportStatus;
  resolutionNote: string | null;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}

/**
 * Texto libre de una solicitud: sin caracteres de control/invisibles, saltos
 * normalizados y longitud acotada. Nunca se interpreta como HTML; el frontend
 * lo renderiza como texto.
 */
export function sanitizeSupportBody(body: string): string {
  return body
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\p{Cc}\p{Cf}]/gu, (char) => (char === '\n' || char === '\t' ? char : ''))
    .replace(/\r\n?/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, SUPPORT_BODY_MAX_LENGTH)
    .trim();
}

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSupportTicketDto): Promise<SupportTicketView> {
    const body = sanitizeSupportBody(dto.body);

    if (body.length < SUPPORT_BODY_MIN_LENGTH) {
      throw new BadRequestException(
        `Cuéntanos un poco más (mínimo ${SUPPORT_BODY_MIN_LENGTH} caracteres).`,
      );
    }

    const open = await this.prisma.supportTicket.count({
      where: {
        userId,
        status: { in: [SupportTicketStatus.OPEN, SupportTicketStatus.IN_PROGRESS] },
      },
    });

    if (open >= MAX_OPEN_TICKETS) {
      throw new ConflictException(
        'Tienes demasiadas solicitudes abiertas. Espera a que se resuelvan antes de enviar otra.',
      );
    }

    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId,
        category: dto.category,
        body,
      },
      select: SUPPORT_SELECT,
    });

    return this.toView(ticket);
  }

  async listMine(userId: string, query: ListMySupportTicketsQueryDto) {
    const take = Math.min(Math.max(query.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

    const rows = await this.prisma.supportTicket.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      select: SUPPORT_SELECT,
    });

    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;

    return {
      items: items.map((row) => this.toView(row)),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    };
  }

  async getMine(userId: string, id: string): Promise<SupportTicketView> {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, userId },
      select: SUPPORT_SELECT,
    });

    if (!ticket) {
      // Un caso ajeno se trata como inexistente para no revelar que existe.
      throw new NotFoundException('Esa solicitud no existe.');
    }

    return this.toView(ticket);
  }

  private toView(row: {
    id: string;
    category: SupportCategory;
    body: string;
    status: SupportStatus;
    resolutionNote: string | null;
    createdAt: Date;
    updatedAt: Date;
    resolvedAt: Date | null;
  }): SupportTicketView {
    return {
      id: row.id,
      category: row.category,
      body: row.body,
      status: row.status,
      resolutionNote: row.resolutionNote,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      resolvedAt: row.resolvedAt,
    };
  }
}
