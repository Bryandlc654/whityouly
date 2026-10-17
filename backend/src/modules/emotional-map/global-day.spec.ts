import { env } from '../../config/env';
import { globalDayRange } from './global-day';

const DAY_MS = 24 * 60 * 60_000;

describe('globalDayRange', () => {
  it('el instante actual cae dentro del día global y este dura 24 horas', () => {
    const now = new Date('2026-10-17T13:45:00.000Z');

    const { start, end, day } = globalDayRange(now);

    expect(now.getTime()).toBeGreaterThanOrEqual(start.getTime());
    expect(now.getTime()).toBeLessThan(end.getTime());
    expect(end.getTime() - start.getTime()).toBe(DAY_MS);
    expect(day).toBe(start.toISOString().slice(0, 10));
  });

  it('empieza a la hora configurada en UTC, en punto', () => {
    const { start } = globalDayRange(new Date('2026-10-17T13:45:00.000Z'));

    expect(start.getUTCHours()).toBe(env.emotional.dayStartHourUtc);
    expect(start.getUTCMinutes()).toBe(0);
    expect(start.getUTCSeconds()).toBe(0);
    expect(start.getUTCMilliseconds()).toBe(0);
  });

  it('el corte pertenece al día nuevo; un milisegundo antes, al anterior', () => {
    const { start, day } = globalDayRange(new Date('2026-10-17T13:45:00.000Z'));

    expect(globalDayRange(new Date(start.getTime())).day).toBe(day);
    expect(globalDayRange(new Date(start.getTime() - 1)).day).not.toBe(day);
  });
});
