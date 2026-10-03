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
