import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CommunityPulseQueryDto } from './community.dto';

async function errorsOf(payload: Record<string, unknown>) {
  const dto = plainToInstance(CommunityPulseQueryDto, payload);
  return validate(dto as object);
}

describe('CommunityPulseQueryDto (validación de entrada)', () => {
  it('acepta una ventana y huso dentro de rango', async () => {
    const errors = await errorsOf({ days: 14, tzOffsetMinutes: -180 });
    expect(errors).toHaveLength(0);
  });

  it('rechaza una ventana de días por debajo del mínimo', async () => {
    const errors = await errorsOf({ days: 0 });
    expect(errors.some((e) => e.property === 'days')).toBe(true);
  });

  it('rechaza una ventana de días por encima del máximo', async () => {
    const errors = await errorsOf({ days: 200 });
    expect(errors.some((e) => e.property === 'days')).toBe(true);
  });

  it('rechaza un desfase horario fuera del rango permitido', async () => {
    const errors = await errorsOf({ tzOffsetMinutes: 9999 });
    expect(errors.some((e) => e.property === 'tzOffsetMinutes')).toBe(true);
  });

  it('convierte los valores de la query a número', async () => {
    const dto = plainToInstance(CommunityPulseQueryDto, { days: '30', tzOffsetMinutes: '60' });
    expect(dto.days).toBe(30);
    expect(dto.tzOffsetMinutes).toBe(60);
  });
});
