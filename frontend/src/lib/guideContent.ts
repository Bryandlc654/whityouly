import type { IconName } from '@/components/wy/icons';

export interface GuideStep {
  icon: IconName;
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
        title: 'Leer y acompañar',
        text: 'Explora relatos y responde con respeto. “Estoy contigo” no exige explicar nada.',
      },
      {
        icon: 'edit',
        title: 'Compartir un relato',
        text: 'Puedes publicar texto, tarjeta visual o audio. También guardar un borrador y volver después.',
      },
      {
        icon: 'heart',
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
    title: 'Cómo usar Mis emociones',
    intro: 'Registra lo que sientes y observa cambios sin convertir tu bienestar en una nota.',
    steps: [
      {
        icon: 'plus',
        title: 'Registrar ahora',
        text: 'Elige una emoción e intensidad. Puedes registrar distintos momentos del día.',
      },
      {
        icon: 'trend',
        title: 'Observa el resumen',
        text: 'Las gráficas muestran intensidad y frecuencia. No hay una forma correcta de sentir.',
      },
      {
        icon: 'calendar',
        title: 'Revisa tu mapa',
        text: 'Día, semana y mes te ayudan a ver contexto. Tu información permanece privada.',
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
