import { describe, expect, it } from 'vitest';
import {
  STORY_CONTENT_MAX_LENGTH,
  STORY_TITLE_MAX_LENGTH,
  sanitizeStoryContent,
  sanitizeStoryTitle,
} from './story-sanitize.js';

describe('sanitizeStoryTitle', () => {
  it('colapsa espacios y recorta extremos', () => {
    expect(sanitizeStoryTitle('  Hoy   dejé   de fingir  ')).toBe('Hoy dejé de fingir');
  });

  it('convierte los saltos de línea en espacios (es una sola línea)', () => {
    expect(sanitizeStoryTitle('Uno\ndos')).toBe('Uno dos');
  });

  it('elimina invisibles y caracteres de control usados para evadir filtros', () => {
    // \u200b es ancho cero y \u202e es de dirección (bidi).
    expect(sanitizeStoryTitle('bue\u200bno\u202e')).toBe('bueno');
  });

  it('normaliza Unicode para evitar homoglifos', () => {
    // "ﬁ" (ligadura) se normaliza a "fi".
    expect(sanitizeStoryTitle('ﬁn')).toBe('fin');
  });

  it('limita la longitud al máximo', () => {
    const result = sanitizeStoryTitle('a'.repeat(STORY_TITLE_MAX_LENGTH + 50));
    expect(result).toHaveLength(STORY_TITLE_MAX_LENGTH);
  });
});

describe('sanitizeStoryContent', () => {
  it('conserva los saltos de línea simples', () => {
    expect(sanitizeStoryContent('Primera línea\nSegunda línea')).toBe(
      'Primera línea\nSegunda línea',
    );
  });

  it('limita las líneas en blanco consecutivas a una', () => {
    expect(sanitizeStoryContent('a\n\n\n\n\nb')).toBe('a\n\nb');
  });

  it('quita los invisibles sin borrar el salto de línea', () => {
    expect(sanitizeStoryContent('a\u200b\nb')).toBe('a\nb');
  });

  it('normaliza los finales de línea de Windows', () => {
    expect(sanitizeStoryContent('a\r\nb')).toBe('a\nb');
  });

  it('limita la longitud al máximo', () => {
    const result = sanitizeStoryContent('x'.repeat(STORY_CONTENT_MAX_LENGTH + 100));
    expect(result).toHaveLength(STORY_CONTENT_MAX_LENGTH);
  });
});
