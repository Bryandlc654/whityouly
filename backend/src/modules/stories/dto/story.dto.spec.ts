import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateStoryDto, UpdateStoryDto } from './story.dto';

async function themeErrors(visualCardTheme: unknown) {
  const dto = plainToInstance(CreateStoryDto, {
    title: 'Un día tranquilo',
    content: 'Hoy pude descansar.',
    visualCardTheme,
  });
  const errors = await validate(dto as object);
  return errors.filter((error) => error.property === 'visualCardTheme');
}

describe('visualCardTheme (tarjeta visual)', () => {
  it.each(['violet', 'lavender', 'minimal~hearts', 'custom-ff8a5c-7b4dff', 'custom-ff8a5c-7b4dff~sparkles'])(
    'acepta %s',
    async (value) => {
      expect(await themeErrors(value)).toHaveLength(0);
    },
  );

  it.each([
    'rojo',
    'violet~estrellas',
    'custom-ff8a5c',
    'custom-FF8A5C-7B4DFF',
    'custom-ff8a5c-7b4dff~dots~waves',
    'violet; DROP TABLE',
    'url(javascript:alert(1))',
    42,
  ])('rechaza %s', async (value) => {
    expect(await themeErrors(value)).not.toHaveLength(0);
  });

  it('permite quitar la tarjeta al editar', async () => {
    const dto = plainToInstance(UpdateStoryDto, { visualCardTheme: null });
    const errors = await validate(dto as object);
    expect(errors.filter((error) => error.property === 'visualCardTheme')).toHaveLength(0);
  });
});
