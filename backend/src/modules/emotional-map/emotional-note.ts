import { NOTE_MAX_LENGTH } from './dto/emotional-log.dto';

/**
 * Recorta sin partir un par subrogado (emoji): separa por puntos de código en
 * lugar de por unidades UTF-16, de modo que nunca queda un carácter roto.
 */
function truncateCodePoints(value: string, max: number): string {
  const codePoints = Array.from(value);
  return codePoints.length <= max ? value : codePoints.slice(0, max).join('');
}

/**
 * Saneado de las notas personales. El texto nunca se interpreta como HTML: se
 * escapa al renderizar. Aquí solo se neutralizan los caracteres que permiten
 * ocultar texto o evadir filtros (invisibles, de control y de dirección), se
 * normaliza el Unicode para evitar homoglifos y se limita la longitud.
 */
export function sanitizeContextNote(value: string): string {
  const collapsed = value
    .normalize('NFKC')
    // Unifica los finales de línea antes de tratar los controles.
    .replace(/\r\n?/g, '\n')
    // \p{Cf} = formato/invisibles (ancho cero, bidi...): se borran sin dejar
    // hueco, porque unidos a una palabra solo sirven para ocultarla.
    .replace(/\p{Cf}/gu, '')
    // \p{Cc} = control. El salto de línea se conserva; el resto se convierte
    // en un espacio para no pegar palabras.
    // eslint-disable-next-line no-control-regex
    .replace(/\p{Cc}/gu, (char) => (char === '\n' ? '\n' : ' '))
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Se recorta por puntos de código para no partir un emoji por la mitad.
  return truncateCodePoints(collapsed, NOTE_MAX_LENGTH).trim();
}
