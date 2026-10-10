require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

/** Contraseña de todos los usuarios de demostración. */
const DEMO_PASSWORD = 'Demo1234!';
const SALT_ROUNDS = 12;

const DEMO = [
  {
    email: 'demo.luz@whityouly.test',
    name: 'LuzEnPausa',
    tagline: 'Escribo lo que no se dice en voz alta.',
    interests: ['Escritura', 'Meditación', 'Naturaleza'],
    stories: [
      {
        title: 'Hoy dejé de fingir que todo estaba bien',
        content:
          'No pasó nada extraordinario. Solo me cansé de responder “todo bien” cuando por dentro necesitaba que alguien escuchara sin intentar arreglarme.',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        categories: ['Relaciones'],
        emotions: ['Tristeza', 'Esperanza'],
        tags: ['Autoestima'],
      },
      {
        title: 'Una pequeña victoria que hoy sí quiero reconocer',
        content:
          'Esta mañana abrí las ventanas, preparé café y llamé a mi hermana. Parecen cosas pequeñas, pero hace un mes no podía hacer ninguna.',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        categories: ['Esperanza'],
        emotions: ['Esperanza', 'Gratitud'],
        tags: ['Superación'],
      },
    ],
  },
  {
    email: 'demo.volver@whityouly.test',
    name: 'VolverAEmpezar',
    tagline: 'Los finales también abren caminos.',
    interests: ['Viajes', 'Fotografía', 'Cambio'],
    stories: [
      {
        title: 'Volví al lugar que durante meses evité',
        content:
          'Pensé que regresar iba a romperme otra vez. En cambio, pude mirar ese lugar y reconocer cuánto había cambiado.',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        categories: ['Aprendizaje'],
        emotions: ['Calma', 'Tristeza'],
        tags: ['Cambio'],
      },
      {
        title: 'La mudanza que me devolvió a mí',
        content:
          'Empacar mis cajas fue empacar también un poco de mi pasado. Hoy, en el piso nuevo, el silencio se siente mío.',
        visibility: 'FOLLOWERS',
        status: 'PUBLISHED',
        categories: ['Cambio'],
        emotions: ['Esperanza'],
        tags: ['Superación', 'Estudios'],
      },
    ],
  },
  {
    email: 'demo.calma@whityouly.test',
    name: 'CalmaDeDomingo',
    tagline: 'Domingos de café y ventana abierta.',
    interests: ['Café', 'Yoga', 'Lectura'],
    stories: [
      {
        title: 'Saborear el domingo sin culpa',
        content:
          'Aprendí que descansar no es perder tiempo. Hoy no hice nada importante y me siento más yo que en toda la semana.',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        categories: ['Salud'],
        emotions: ['Calma', 'Gratitud'],
        tags: ['Autoestima'],
      },
      {
        title: 'Mi rincón de la mañana',
        content: 'Una ventana, un café y quince minutos para respirar. Ese es mi ritual de aterrizaje.',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        categories: ['Esperanza'],
        emotions: ['Calma'],
        tags: [],
      },
    ],
  },
  {
    email: 'demo.sendero@whityouly.test',
    name: 'SenderoDeLuna',
    tagline: 'Cuento cuentos que la noche me susurra.',
    interests: ['Lectura', 'Historia', 'Pintura'],
    stories: [
      {
        title: 'La luna también tiene sus noches',
        content:
          'Hay noches en las que la luna no alumbra y aun así sigue ahí. Me di cuenta de que yo también puedo simplemente estar.',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        categories: ['Soledad'],
        emotions: ['Soledad', 'Esperanza'],
        tags: ['Familia'],
      },
    ],
  },
  {
    email: 'demo.brisa@whityouly.test',
    name: 'BrisaDelAlba',
    tagline: 'Amiga de los amaneceres y de volver a intentarlo.',
    interests: ['Dibujo', 'Música', 'Voluntariado'],
    stories: [
      {
        title: 'Intentarlo otra vez antes de rendirme',
        content:
          'Fallé el intento, no el camino. Esta mañana volví a dibujar y el trazo salió torcido, pero salió.',
        visibility: 'PUBLIC',
        status: 'PUBLISHED',
        categories: ['Aprendizaje'],
        emotions: ['Esperanza', 'Ansiedad'],
        tags: ['Superación'],
      },
      {
        title: 'La canción que me sacó del silencio',
        content:
          'Hay canciones que aparecen justo cuando el corazón lo necesita. Esta me recordó que quedaba algo por decir.',
        visibility: 'FOLLOWERS',
        status: 'PUBLISHED',
        categories: ['Salud'],
        emotions: ['Tristeza', 'Calma'],
        tags: ['Amistad'],
      },
    ],
  },
];

async function resolveTaxonomy(story, catalogs) {
  const categoryIds = (story.categories ?? []).flatMap((name) => {
    const item = catalogs.categories.find((c) => c.name === name);
    return item ? [item.id] : [];
  });
  const emotionIds = (story.emotions ?? []).flatMap((name) => {
    const item = catalogs.emotions.find((e) => e.name === name);
    return item ? [item.id] : [];
  });
  const tagIds = (story.tags ?? []).flatMap((name) => {
    const item = catalogs.tags.find((t) => t.name === name);
    return item ? [item.id] : [];
  });
  return { categoryIds, emotionIds, tagIds };
}

async function main() {
  // Catálogo publicado.
  const catalogs = {
    categories: await prisma.category.findMany({ select: { id: true, name: true } }),
    emotions: await prisma.emotion.findMany({ select: { id: true, name: true } }),
    tags: await prisma.tag.findMany({ select: { id: true, name: true } }),
  };

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);
  const createdUsers = [];
  const createdStories = [];

  for (const demo of DEMO) {
    const existingUser = await prisma.user.findUnique({ where: { email: demo.email } });
    if (existingUser) {
      console.log(`Omitido (ya existe): ${demo.email}`);
      continue;
    }

    const existingCharacter = await prisma.character.findFirst({ where: { name: demo.name } });
    if (existingCharacter) {
      console.log(`Omitido (el personaje ${demo.name} ya existe).`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: demo.email,
        passwordHash,
        internalUsername: demo.name.toLowerCase(),
        isEmailVerified: true,
        status: 'ACTIVE',
        role: 'USER',
        preferences: {
          create: {
            emailNotifications: false,
            pushNotifications: false,
            theme: 'light',
            language: 'es',
          },
        },
      },
      select: { id: true },
    });

    const character = await prisma.character.create({
      data: {
        userId: user.id,
        name: demo.name,
        tagline: demo.tagline,
        bio: 'Personaje de demostración de la plataforma.',
        privacySettings: { profileVisibility: 'PUBLIC', showAvatar: true, showBio: true },
      },
      select: { id: true },
    });

    // Intereses del personaje (catálogo propio de intereses).
    const interestIds = (
      await prisma.interest.findMany({ where: { name: { in: demo.interests } }, select: { id: true } })
    ).map((row) => row.id);
    if (interestIds.length > 0) {
      await prisma.characterInterest.createMany({
        data: interestIds.map((interestId) => ({ characterId: character.id, interestId })),
        skipDuplicates: true,
      });
    }

    for (const story of demo.stories) {
      const { categoryIds, emotionIds, tagIds } = await resolveTaxonomy(story, catalogs);
      const created = await prisma.story.create({
        data: {
          characterId: character.id,
          title: story.title,
          visibility: story.visibility,
          status: story.status,
          updates: { create: { content: story.content, stageOrder: 1 } },
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
          emotions: { create: emotionIds.map((emotionId) => ({ emotionId })) },
          tags: { create: tagIds.map((tagId) => ({ tagId })) },
        },
        select: { id: true, title: true },
      });
      createdStories.push(created);
    }

    createdUsers.push({ id: user.id, name: demo.name, characterId: character.id });
    console.log(`Creado: ${demo.name} (${demo.email})`);
  }

  // Algunas relaciones de comunidad para que el feed se vea vivo.
  const allChars = await prisma.character.findMany({ select: { id: true, name: true } });
  const allStories = await prisma.story.findMany({ where: { status: 'PUBLISHED' }, select: { id: true } });

  if (createdUsers.length > 1) {
    // Seguir al usuario anterior.
    for (let i = 1; i < createdUsers.length; i++) {
      const prev = createdUsers[i - 1];
      const cur = createdUsers[i];
      await prisma.follower
        .create({ data: { followerId: cur.characterId, followingCharacterId: prev.characterId } })
        .catch(() => undefined);
    }
    // Acompañamientos.
    if (allStories.length >= 2) {
      await prisma.companionship
        .create({ data: { characterId: createdUsers[1].characterId, targetStoryId: allStories[0].id } })
        .catch(() => undefined);
      await prisma.companionship
        .create({ data: { characterId: createdUsers[0].characterId, targetStoryId: allStories[1]?.id ?? allStories[0].id } })
        .catch(() => undefined);
    }
    // Algunos comentarios.
    if (allStories.length > 0 && createdUsers.length >= 2) {
      const a = allStories[0];
      const [b1, b2] = createdUsers;
      await prisma.comment
        .create({
          data: {
            storyId: a.id,
            characterId: b2.characterId,
            content: 'Gracias por compartir esto. Me hizo sentir menos solo.',
          },
        })
        .catch(() => undefined);
      await prisma.comment
        .create({
          data: { storyId: a.id, characterId: b1.characterId, content: 'Que bonito que pudieras escribirlo.' },
        })
        .catch(() => undefined);
    }
  }

  console.log(`Usuarios creados: ${createdUsers.length}`);
  console.log(`Historias creadas: ${createdStories.length}`);
  console.log(`Contraseña demo: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('El seed de demos falló:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());