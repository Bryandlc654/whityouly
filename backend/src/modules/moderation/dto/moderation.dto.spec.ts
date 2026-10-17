import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  APPEAL_MESSAGE_MAX_LENGTH,
  CreateAppealDto,
  ListAppealsQueryDto,
  ListReportsQueryDto,
  ModerateContentDto,
  ResolveAppealDto,
  UpdateReportDto,
} from './moderation.dto';

const UUID = '11111111-1111-4111-8111-111111111111';

async function errorsOf(cls: any, payload: Record<string, unknown>) {
  const dto = plainToInstance(cls, payload);
  return validate(dto as object);
}

describe('moderation DTOs (validación de entrada)', () => {
  describe('CreateAppealDto', () => {
    it('acepta una apelación válida', async () => {
      const errors = await errorsOf(CreateAppealDto, {
        targetType: 'STORY',
        targetId: UUID,
        message: 'Mi relato no incumple las normas de la comunidad.',
      });
      expect(errors).toHaveLength(0);
    });

    it('rechaza un motivo de menos de 10 caracteres', async () => {
      const errors = await errorsOf(CreateAppealDto, {
        targetType: 'STORY',
        targetId: UUID,
        message: 'corto',
      });
      expect(errors.some((e) => e.property === 'message')).toBe(true);
    });

    it('rechaza un motivo que supera el máximo', async () => {
      const errors = await errorsOf(CreateAppealDto, {
        targetType: 'STORY',
        targetId: UUID,
        message: 'x'.repeat(APPEAL_MESSAGE_MAX_LENGTH + 1),
      });
      expect(errors.some((e) => e.property === 'message')).toBe(true);
    });

    it('solo permite apelar STORY o COMMENT', async () => {
      const errors = await errorsOf(CreateAppealDto, {
        targetType: 'USER',
        targetId: UUID,
        message: 'motivo suficientemente largo',
      });
      expect(errors.some((e) => e.property === 'targetType')).toBe(true);
    });

    it('exige un identificador UUID', async () => {
      const errors = await errorsOf(CreateAppealDto, {
        targetType: 'STORY',
        targetId: 'no-es-un-uuid',
        message: 'motivo suficientemente largo',
      });
      expect(errors.some((e) => e.property === 'targetId')).toBe(true);
    });
  });

  describe('ResolveAppealDto', () => {
    it('solo acepta ACCEPTED o REJECTED', async () => {
      const invalid = await errorsOf(ResolveAppealDto, { status: 'PENDING' });
      expect(invalid.some((e) => e.property === 'status')).toBe(true);

      const valid = await errorsOf(ResolveAppealDto, {
        status: 'ACCEPTED',
        resolutionNote: 'Revisado, procede.',
      });
      expect(valid).toHaveLength(0);
    });
  });

  describe('ModerateContentDto', () => {
    it('solo acepta HIDE o RESTORE', async () => {
      expect((await errorsOf(ModerateContentDto, { action: 'HIDE' })).length).toBe(0);
      expect((await errorsOf(ModerateContentDto, { action: 'DELETE' })).length).toBe(1);
    });
  });

  describe('ListReportsQueryDto', () => {
    it('solo acepta estados y tipos de reporte conocidos', async () => {
      const invalid = await errorsOf(ListReportsQueryDto, { status: 'NOPE', type: 'NOPE' });
      expect(invalid.some((e) => e.property === 'status')).toBe(true);
      expect(invalid.some((e) => e.property === 'type')).toBe(true);

      const valid = await errorsOf(ListReportsQueryDto, { status: 'PENDING', type: 'STORY' });
      expect(valid).toHaveLength(0);
    });
  });

  describe('UpdateReportDto', () => {
    it('solo acepta un estado de reporte conocido', async () => {
      expect((await errorsOf(UpdateReportDto, { status: 'IN_REVIEW' })).length).toBe(0);
      expect((await errorsOf(UpdateReportDto, { status: 'INVENTED' })).length).toBe(1);
    });
  });

  describe('ListAppealsQueryDto', () => {
    it('rechaza un cursor que no es UUID', async () => {
      const errors = await errorsOf(ListAppealsQueryDto, { cursor: 'bad-cursor' });
      expect(errors.some((e) => e.property === 'cursor')).toBe(true);
    });
  });
});
