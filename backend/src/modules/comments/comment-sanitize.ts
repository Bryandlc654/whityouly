export const COMMENT_MAX_LENGTH = 2000;

/**
 * Saneado del texto de un comentario: igual criterio que los relatos (sin
 * invisibles ni caracteres de control, saltos de línea conservados, límite de
 * extensión). Nunca se interpreta como HTML: se escapa al renderizar.
 */
export function sanitizeCommentContent(content: string): string {
  return (
    content
      .normalize('NFKC')
      .replace(/\r\n?/g, '\n')
      .replace(/\p{Cf}/gu, '')
      // eslint-disable-next-line no-control-regex
      .replace(/\p{Cc}/gu, (char) => (char === '\n' ? '\n' : ' '))
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, COMMENT_MAX_LENGTH)
      .trim()
  );
}