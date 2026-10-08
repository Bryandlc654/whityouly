export const STORY_TITLE_MAX_LENGTH = 120;
export const STORY_CONTENT_MAX_LENGTH = 5000;

/**
 * Saneado de texto de usuario. El contenido nunca se interpreta como HTML: se
 * escapa al renderizar. Aquí solo se neutralizan los caracteres que permiten
 * ocultar texto o evadir filtros (invisibles, de control y de dirección), se
 * normaliza el Unicode para evitar homoglifos y se limita la longitud.
 */
function stripInvisibleAndControl(value: string, keepNewlines: boolean): string {
  return (
    value
      .normalize('NFKC')
      // Unifica los finales de línea antes de tratar los controles.
      .replace(/\r\n?/g, '\n')
      // \p{Cf} = formato/invisibles (ancho cero, bidi...): se borran sin dejar
      // hueco, porque unidos a una palabra solo sirven para ocultarla o evadir
      // filtros.
      .replace(/\p{Cf}/gu, '')
      // \p{Cc} = control. El salto de línea se conserva si el campo es de varias
      // líneas; el resto (tabuladores, etc.) se convierte en un espacio para no
      // pegar palabras.
      // eslint-disable-next-line no-control-regex
      .replace(/\p{Cc}/gu, (char) => (char === '\n' ? (keepNewlines ? '\n' : ' ') : ' '))
  );
}

/** El título es una sola línea: los saltos se convierten en espacios. */
export function sanitizeStoryTitle(title: string): string {
  return stripInvisibleAndControl(title, false)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, STORY_TITLE_MAX_LENGTH)
    .trim();
}

/**
 * El cuerpo de una etapa conserva los saltos de línea y, como mucho, una línea
 * en blanco seguida: los huecos largos se usan para empujar contenido fuera de
 * la vista sin escribir nada.
 */
export function sanitizeStoryContent(content: string): string {
  return stripInvisibleAndControl(content, true)
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, STORY_CONTENT_MAX_LENGTH)
    .trim();
}
