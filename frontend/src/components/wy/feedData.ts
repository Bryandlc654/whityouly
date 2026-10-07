// Extraido del prototipo Withyouly v7 (app.js). Datos de ejemplo: el backend
// todavia no tiene modulo de historias.
export interface DemoStory {
  id: string;
  author: string;
  initials: string;
  time: string;
  category: string;
  updateKind: string;
  updateDate: string;
  updateText: string;
  title: string;
  text: string;
  support: number;
  comments: number;
  music?: string;
}

export const DEMO_STORIES: DemoStory[] = [
  {
    "id": "pausa",
    "author": "LuzEnPausa",
    "initials": "LP",
    "time": "Hace 18 minutos",
    "category": "Relaciones",
    "updateKind": "Hubo una conversación",
    "updateDate": "Hoy",
    "updateText": "Después de escribirlo, decidí hablar con esa persona. No resolvimos todo, pero pude decir lo que necesitaba.",
    "title": "Hoy dejé de fingir que todo estaba bien",
    "text": "No pasó nada extraordinario. Solo me cansé de responder “todo bien” cuando por dentro necesitaba que alguien escuchara sin intentar arreglarme. Escribirlo aquí ya hizo que pesara un poco menos.",
    "support": 128,
    "comments": 24,
    "music": "Satélites — Pablo Alborán"
  },
  {
    "id": "volver",
    "author": "VolverAEmpezar",
    "initials": "VE",
    "time": "Hace 43 minutos",
    "category": "Aprendizaje",
    "updateKind": "Nueva reflexión",
    "updateDate": "Ayer",
    "updateText": "Entendí que volver no significaba retroceder, sino comprobar cuánto había cambiado.",
    "title": "Volví al lugar que durante meses evité",
    "text": "Pensé que regresar iba a romperme otra vez. En cambio, pude mirar ese lugar y reconocer cuánto había cambiado. No estoy completamente bien, pero hoy entendí que avanzar también puede sentirse silencioso.",
    "support": 91,
    "comments": 17
  },
  {
    "id": "domingo",
    "author": "CalmaDeDomingo",
    "initials": "CD",
    "time": "Hace 1 hora",
    "category": "Esperanza",
    "updateKind": "Cierre compartido",
    "updateDate": "Hace 3 días",
    "updateText": "Quiero guardar este capítulo como recordatorio de que incluso los avances pequeños cuentan.",
    "title": "Una pequeña victoria que hoy sí quiero reconocer",
    "text": "Esta mañana abrí las ventanas, preparé café y llamé a mi hermana. Parecen cosas pequeñas, pero hace un mes no podía hacer ninguna. Hoy quiero guardar este momento para recordarme que los días difíciles sí cambian.",
    "support": 206,
    "comments": 38,
    "music": "Brillas — León Larregui"
  }
];

export const DAILY_INTENSITY = [6, 5, 8, 7, 9, 8, 9];
