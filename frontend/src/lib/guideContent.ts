import type { IconName } from '@/components/wy/icons';

export interface GuideStep {
  icon: IconName;
  image?: string;
  title: string;
  text: string;
}

export interface GuideContent {
  title: string;
  intro: string;
  steps: GuideStep[];
}

export const GUIDES: Record<'start' | 'diary' | 'mood' | 'care' | 'tree' | 'capsules', GuideContent> = {
  start: {
    title: 'Cómo empezar',
    intro: 'Tres formas sencillas de usar Withyouly sin exponer tu identidad real.',
    steps: [
      {
        icon: 'book',
        image: '/help/write.svg',
        title: 'Leer y acompañar',
        text: 'Explora relatos y responde con respeto. “Estoy contigo” no exige explicar nada.',
      },
      {
        icon: 'edit',
        image: '/help/format.svg',
        title: 'Compartir un relato',
        text: 'Puedes publicar texto, tarjeta visual o audio. También guardar un borrador y volver después.',
      },
      {
        icon: 'heart',
        image: '/help/published.svg',
        title: 'Un momento para ti',
        text: 'Mi espacio reúne diario, emociones, cuidado, árbol y cápsulas. Todo privado y opcional.',
      },
    ],
  },
  diary: {
    title: 'Cómo usar Mi diario',
    intro: 'Un espacio privado para guardar lo que quieras recordar, sin emoción obligatoria.',
    steps: [
      {
        icon: 'edit',
        title: 'Escribe una nota',
        text: 'Puedes poner título o dejarlo vacío. Solo tú puedes leerla.',
      },
      {
        icon: 'pulse',
        title: 'Registra cómo te sientes',
        text: 'Las emociones comparten espacio con las notas y se pueden revisar por fecha.',
      },
      {
        icon: 'search',
        title: 'Encuentra y edita',
        text: 'Busca por palabra, filtra por tipo o fecha y recupera notas desde la papelera.',
      },
    ],
  },
  mood: {
    title: 'Guía de tu registro emocional',
    intro: 'Una guía breve para registrar lo que sientes y observar tus patrones privados.',
    steps: [
      {
        icon: 'heart',
        title: 'Elige lo que más se acerca',
        text: 'Escoge una emoción principal. No tiene que describir todo lo que sientes; es solamente una fotografía del momento.',
      },
      {
        icon: 'pulse',
        title: 'Registra la intensidad',
        text: 'El número indica cuánta fuerza tiene la emoción, no si es buena o mala. También puedes indicar mañana, tarde, noche o todo el día.',
      },
      {
        icon: 'sparkle',
        title: 'Elige qué necesitas',
        text: 'Después de guardar puedes pedir una pausa, ordenar tus ideas, desahogarte, sentir compañía o simplemente continuar.',
      },
      {
        icon: 'trend',
        title: 'Observa, sin diagnosticarte',
        text: 'Tus gráficas muestran patrones privados. No son una evaluación médica y nunca se publican en tu perfil.',
      },
    ],
  },
  care: {
    title: 'Cómo usar Cuidarme',
    intro: 'Actividades breves para acompañarte. No hay puntos ni respuestas correctas.',
    steps: [
      {
        icon: 'pulse',
        title: 'Elige una pausa',
        text: 'Respira, desenreda una idea o elige un paso pequeño y realista.',
      },
      {
        icon: 'heart',
        title: 'Hazlo a tu ritmo',
        text: 'Puedes guardar una acción para después, completarla o simplemente mirar las opciones.',
      },
      {
        icon: 'shield',
        title: 'Sin obligación',
        text: 'No necesitas completar todo. Elegir una acción no equivale a completarla.',
      },
    ],
  },
  tree: {
    title: 'Cómo crece tu árbol',
    intro: 'Tu progreso reconoce cuidado y expresión. Es privado y no se pierde por ausencias.',
    steps: [
      {
        icon: 'sparkle',
        title: 'Hasta tres gotas al día',
        text: 'Autoconocimiento, cuidado o expresión y acompañamiento pueden sumar una gota cada uno.',
      },
      {
        icon: 'trend',
        title: 'Avanza por etapas',
        text: 'Cada 300 gotas completan un árbol y abren un nuevo ciclo. Los anteriores pasan al jardín.',
      },
      {
        icon: 'calendar',
        title: 'A tu ritmo',
        text: 'Los días no tienen que ser consecutivos. Todas las emociones cuentan igual.',
      },
      {
        icon: 'shield',
        title: 'Privado y sin comparaciones',
        text: 'Tu árbol no se compara con el de otras personas ni concede permisos especiales.',
      },
    ],
  },
  capsules: {
    title: 'Cómo usar Cápsulas',
    intro: 'Guarda un mensaje privado para tu yo del futuro y elige cuándo abrirlo.',
    steps: [
      {
        icon: 'edit',
        title: 'Escribe para tu futuro',
        text: 'Puede ser un recuerdo, una idea o algo que quieras decirte más adelante.',
      },
      {
        icon: 'calendar',
        title: 'Elige una fecha',
        text: 'La cápsula quedará disponible cuando llegue el día. Solo tú podrás abrirla.',
      },
      {
        icon: 'check',
        title: 'Vuelve cuando quieras',
        text: 'Puedes editarla o eliminarla antes de la fecha y releerla después de abrirla.',
      },
    ],
  },
};
