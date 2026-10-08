require('dotenv/config');

const { PrismaClient } = require('@prisma/client');

/**
 * Catálogo cerrado de intereses. Vive en el código y no en una interfaz de
 * administración a propósito: es la lista que la interfaz ofrece al elegir, y
 * cualquier etiqueta nueva tiene que revisarse antes de publicarse. El orden no
 * importa porque `InterestsService` la devuelve ordenada alfabéticamente.
 *
 * Ojo: el listado es exhaustivo a propósito. Lo que una persona ya eligió no se
 * toca al reejecutar el seed, aunque su interés desaparezca de esta lista.
 */
const INTERESTS = [
  'Ajedrez',
  'Arte',
  'Astronomía',
  'Café',
  'Caligrafía',
  'Ciclismo',
  'Cine',
  'Cocina',
  'Cómic',
  'Danza',
  'Dibujo',
  'Escritura',
  'Fotografía',
  'Historia',
  'Idiomas',
  'Jardinería',
  'Lectura',
  'Mascotas',
  'Meditación',
  'Música',
  'Nadar',
  'Naturaleza',
  'Panadería',
  'Pintura',
  'Senderismo',
  'Teatro',
  'Viajes',
  'Videojuegos',
  'Voluntariado',
  'Yoga',
];

/**
 * Catálogo curado de categorías del relato. Igual que los intereses, es una
 * lista cerrada: quien publica elige de aquí y no puede inventar categorías sin
 * moderar. El orden no importa (se devuelven alfabéticamente).
 */
const CATEGORIES = [
  'Aprendizaje',
  'Ansiedad',
  'Autoestima',
  'Cambio',
  'Esperanza',
  'Familia',
  'Gratitud',
  'Pérdida',
  'Relaciones',
  'Salud',
  'Soledad',
  'Trabajo',
];

/**
 * Catálogo de emociones con su color. El color lo usa la interfaz para dibujar
 * el estado emocional; se guarda aquí para no duplicarlo en el frontend.
 */
const EMOTIONS = [
  { name: 'Alegría', colorHex: '#f1a83b' },
  { name: 'Ansiedad', colorHex: '#f1a83b' },
  { name: 'Calma', colorHex: '#43c8d9' },
  { name: 'Esperanza', colorHex: '#37a978' },
  { name: 'Gratitud', colorHex: '#37a978' },
  { name: 'Ira', colorHex: '#df5d67' },
  { name: 'Miedo', colorHex: '#df5d67' },
  { name: 'Neutral', colorHex: '#9ba1b2' },
  { name: 'Soledad', colorHex: '#8b5cff' },
  { name: 'Tristeza', colorHex: '#4b83e5' },
];

/**
 * Catálogo de etiquetas. Se mantiene curado (no texto libre) para impedir que
 * las etiquetas se usen como vector de spam o de contenido sin moderar.
 */
const TAGS = [
  'Amistad',
  'Autoestima',
  'Cambio',
  'Duelo',
  'Estudios',
  'Familia',
  'Pareja',
  'Pérdida',
  'Superación',
  'Trabajo',
];

async function main() {
  const prisma = new PrismaClient();

  try {
    // `skipDuplicates` hace que el seed sea idempotente: se puede reejecutar en
    // cada despliegue sin tocar lo que ya existe ni fallar por duplicados.
    const { count } = await prisma.interest.createMany({
      data: INTERESTS.map((name) => ({ name })),
      skipDuplicates: true,
    });

    const total = await prisma.interest.count();

    console.log(`Intereses nuevos: ${count}. Intereses en el catálogo: ${total}.`);

    // Categorías y etiquetas: catálogos sin atributos extra.
    const categories = await prisma.category.createMany({
      data: CATEGORIES.map((name) => ({ name })),
      skipDuplicates: true,
    });
    const tags = await prisma.tag.createMany({
      data: TAGS.map((name) => ({ name })),
      skipDuplicates: true,
    });

    console.log(
      `Categorías nuevas: ${categories.count} (${await prisma.category.count()} en total). ` +
        `Etiquetas nuevas: ${tags.count} (${await prisma.tag.count()} en total).`,
    );

    // Las emociones llevan color: `upsert` permite refrescarlo si cambia sin
    // romper el seed ni duplicar filas.
    for (const emotion of EMOTIONS) {
      await prisma.emotion.upsert({
        where: { name: emotion.name },
        update: { colorHex: emotion.colorHex },
        create: emotion,
      });
    }

    console.log(`Emociones en el catálogo: ${await prisma.emotion.count()}.`);

    // Un interés que ya no está en la lista se conserva a propósito: borrarlo
    // eliminaría en cascada las elecciones de quien lo tenía puesto. Se avisa
    // para que la retirada sea una decisión consciente, no un efecto colateral.
    const current = await prisma.interest.findMany({ select: { name: true } });
    const known = new Set(INTERESTS.map((name) => name.toLowerCase()));
    const retired = current.map((row) => row.name).filter((name) => !known.has(name.toLowerCase()));

    if (retired.length > 0) {
      console.warn(
        `Estos intereses ya no están en la lista del seed y se han dejado intactos: ${retired.join(', ')}.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('El seed de intereses falló:', error);
  process.exit(1);
});
