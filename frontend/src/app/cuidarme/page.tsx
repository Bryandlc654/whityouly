'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_URL } from '@/lib/api';
import { authFetch, logout as endSession, tokenStorage } from '@/lib/auth';
import type { CharacterSummary } from '@/components/feed/types';
import Icon from '@/components/wy/Icon';
import MiEspacioNav from '@/components/wy/MiEspacioNav';
import Guide58Modal from '@/components/wy/Guide58Modal';
import type { IconName } from '@/components/wy/icons';
import RightRail from '@/components/wy/RightRail';
import WyFrame, { type WyRoute } from '@/components/wy/Shell';
import { Sheet, type SheetRow } from '@/components/wy/Overlays';
import { MOOD_EMOJI } from '@/components/wy/MoodModal';
import { listEmotionalLogs } from '@/lib/emotionalMap';
import {
  createCareActivity,
  listCareActivities,
  updateCareActivity,
  type CareActivity,
  type CareActivityStatus,
  type CareActivityType,
  type CareOutcome,
} from '@/lib/careActivities';
import PageSkeleton from '@/components/wy/PageSkeleton';

type View = 'library' | 'calm' | 'thoughts' | 'small' | 'vent' | 'company' | 'distract';
type BreathStage = 'intro' | 'running' | 'done';

interface LatestMood {
  name: string;
  intensity: number;
}

interface Completion {
  id: string;
  awarded: boolean;
  reflectionSaved: boolean;
}

interface BreathState {
  stage: BreathStage;
  remaining: number;
  phase: number;
  phaseRemaining: number;
  paused: boolean;
  calmBefore: number;
  effect: CareOutcome | null;
}

interface UnravelAnswers {
  origin: string;
  need: string;
  action: string;
}

interface SmallState {
  action: string;
  plannedId: string | null;
  completed: boolean;
  awarded: boolean;
}

interface UnravelStep {
  key: keyof UnravelAnswers;
  eyebrow: string;
  title: string;
  copy: string;
  choices: { icon: IconName; label: string }[];
}

const BREATH_PHASES = [
  { key: 'inhale', label: 'Inhala suavemente', cue: 'Deja que el aire entre sin forzarlo', seconds: 4 },
  { key: 'hold', label: 'Pausa cómoda', cue: 'No aprietes la garganta ni el pecho', seconds: 2 },
  { key: 'exhale', label: 'Exhala lentamente', cue: 'Suelta el aire como si enfriaras una bebida', seconds: 6 },
] as const;

const UNRAVEL_STEPS: UnravelStep[] = [
  {
    key: 'origin',
    eyebrow: 'PASO 1 DE 3',
    title: '¿Dónde pudo comenzar?',
    copy: 'No necesitas estar completamente seguro. “No lo tengo claro” también es una respuesta válida.',
    choices: [
      { icon: 'book', label: 'Trabajo o estudios' },
      { icon: 'heart', label: 'Relaciones' },
      { icon: 'users', label: 'Familia' },
      { icon: 'pulse', label: 'Mi cuerpo o salud' },
      { icon: 'sparkle', label: 'Algo que recordé' },
      { icon: 'help', label: 'No lo tengo claro' },
    ],
  },
  {
    key: 'need',
    eyebrow: 'PASO 2 DE 3',
    title: '¿Qué necesitas ahora?',
    copy: 'Elige lo que sería más amable y útil para ti en este momento.',
    choices: [
      { icon: 'users', label: 'Ser escuchado' },
      { icon: 'sparkle', label: 'Calmar mi mente' },
      { icon: 'book', label: 'Ordenar ideas' },
      { icon: 'heart', label: 'Sentir compañía' },
      { icon: 'pause', label: 'Descansar' },
      { icon: 'check', label: 'Dar un paso pequeño' },
    ],
  },
  {
    key: 'action',
    eyebrow: 'PASO 3 DE 3',
    title: 'Elige un paso pequeño',
    copy: 'No tienes que resolverlo todo hoy. Escoge una acción posible, incluso si prefieres pausar.',
    choices: [
      { icon: 'edit', label: 'Escribir dos líneas en privado' },
      { icon: 'pulse', label: 'Tomar agua y respirar sin prisa' },
      { icon: 'message', label: 'Hablar con alguien de confianza' },
      { icon: 'pause', label: 'Alejarme cinco minutos' },
      { icon: 'shield', label: 'No hacer nada por ahora' },
      { icon: 'calendar', label: 'Elegirlo más tarde' },
    ],
  },
];

const SMALL_OPTIONS: { icon: IconName; label: string }[] = [
  { icon: 'pulse', label: 'Beber un vaso de agua' },
  { icon: 'globe', label: 'Abrir una ventana y respirar' },
  { icon: 'trend', label: 'Caminar durante dos minutos' },
  { icon: 'heart', label: 'Estirar hombros y cuello' },
  { icon: 'message', label: 'Escribir a alguien de confianza' },
  { icon: 'pause', label: 'Descansar sin sentir culpa' },
];

const COMPANY_OPTIONS: { key: string; icon: IconName; title: string; copy: string; action: string }[] = [
  {
    key: 'read',
    icon: 'book',
    title: 'Leer un relato que acompañe',
    copy: 'Historias de otras personas que también han necesitado una pausa.',
    action: 'Abrir Explorar',
  },
  {
    key: 'message',
    icon: 'message',
    title: 'Escribir a alguien de confianza',
    copy: 'Puedes usar una frase sencilla. No tienes que explicarlo todo.',
    action: 'Copiar mensaje',
  },
  {
    key: 'resources',
    icon: 'shield',
    title: 'Ver recursos de apoyo',
    copy: 'Guías, ayuda y canales para cuando necesitas algo más.',
    action: 'Abrir ayuda',
  },
];

const DISTRACT_OPTIONS: { key: string; icon: IconName; title: string; copy: string }[] = [
  {
    key: 'walk',
    icon: 'trend',
    title: 'Caminar dos minutos',
    copy: 'Muévete sin prisa, aunque sea por tu casa.',
  },
  {
    key: 'music',
    icon: 'music',
    title: 'Escuchar una canción',
    copy: 'Elige algo que no te haga daño y te permita tomar distancia.',
  },
  {
    key: 'tidy',
    icon: 'sparkle',
    title: 'Ordenar un espacio pequeño',
    copy: 'Una mesa, una esquina, una sola cosa.',
  },
  {
    key: 'window',
    icon: 'globe',
    title: 'Mirar por la ventana',
    copy: 'Nombra cinco cosas que ves y respira sin prisa.',
  },
];

const EFFECTS: { value: CareOutcome; label: string }[] = [
  { value: 'better', label: 'Un poco mejor' },
  { value: 'same', label: 'Igual' },
  { value: 'worse', label: 'Un poco peor' },
  { value: 'unsure', label: 'No estoy seguro' },
];

const RECOGNITION: Record<CareActivityType, { title: string; copy: string }> = {
  BREATHING: {
    title: 'Te diste una pausa',
    copy: 'Un minuto de respiración sin exigirte cambiar lo que sientes.',
  },
  UNRAVEL: {
    title: 'Separaste las piezas',
    copy: 'Poner nombre a lo que necesitas ya es una forma de cuidado.',
  },
  SMALL_STEP: {
    title: 'Elegiste un paso posible',
    copy: 'No tiene que cambiar todo el día. Lo pequeño también cuenta.',
  },
  VENT: {
    title: 'Te escuchaste sin publicar',
    copy: 'Escribir en privado puede ayudar a ordenar lo que sientes.',
  },
  COMPANY: {
    title: 'Buscaste compañía',
    copy: 'No tienes que sostenerlo todo en soledad.',
  },
  DISTRACT: {
    title: 'Te diste distancia',
    copy: 'Unos minutos de pausa también son una forma de cuidarte.',
  },
};

const EMPTY_ANSWERS: UnravelAnswers = { origin: '', need: '', action: '' };

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function moodEmoji(name: string | null | undefined) {
  return (name && MOOD_EMOJI[name]) || '·';
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function unravelReflection(feeling: string, answers: UnravelAnswers) {
  return [
    `Cómo me sentía: ${feeling}`,
    `Puede venir de: ${answers.origin}`,
    `Lo que necesito: ${answers.need}`,
    `Mi próximo paso: ${answers.action}`,
  ].join('\n');
}

function pendingAction(activity: CareActivity): string {
  const value = activity.metadata?.action;
  return typeof value === 'string' && value.trim() ? value : 'Tu paso pendiente';
}
function Recognition({ activity, completion }: { activity: CareActivityType; completion: Completion | null }) {
  if (!completion) return null;
  const copy = RECOGNITION[activity];

  return (
    <section className="care-recognition" aria-live="polite">
      <div className="care-recognition-mark">
        <Icon name="sparkle" />
      </div>
      <div>
        <span className="micro-label">RECONOCIMIENTO</span>
        <h3>{copy.title}</h3>
        <p>{copy.copy}</p>
        <small>
          {completion.awarded
            ? 'Tu árbol recibió una gota de cuidado.'
            : 'Ya registraste una gota de cuidado hoy; este momento también cuenta.'}
        </small>
      </div>
    </section>
  );
}

function ReflectionEditor({
  value,
  onChange,
  onSave,
  saving,
  saved,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  disabled: boolean;
  placeholder: string;
}) {
  return (
    <div className="care-reflection">
      <label className="field-label" htmlFor="careReflection">
        Reflexión privada opcional
      </label>
      <textarea
        id="careReflection"
        className="field"
        value={value}
        maxLength={5000}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <div className="care-reflection-actions">
        <button
          className="secondary"
          type="button"
          onClick={onSave}
          disabled={disabled || saving || saved || !value.trim()}
        >
          {saving ? 'Guardando…' : saved ? 'Reflexión guardada' : 'Guardar reflexión'}
        </button>
        <small>Solo tú puedes verla.</small>
      </div>
    </div>
  );
}

export default function CarePage() {
  const router = useRouter();

  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [latestMood, setLatestMood] = useState<LatestMood | null>(null);
  const [pendingSteps, setPendingSteps] = useState<CareActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);

  const [view, setView] = useState<View>('library');
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [reflection, setReflection] = useState('');
  const [savingActivity, setSavingActivity] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);
  const [activityError, setActivityError] = useState('');

  const [breath, setBreath] = useState<BreathState>({
    stage: 'intro',
    remaining: 60,
    phase: 0,
    phaseRemaining: BREATH_PHASES[0].seconds,
    paused: false,
    calmBefore: 5,
    effect: null,
  });
  const breathSavedRef = useRef(false);

  const [unravel, setUnravel] = useState<{ step: number; answers: UnravelAnswers }>({
    step: 0,
    answers: EMPTY_ANSWERS,
  });
  const [unravelDone, setUnravelDone] = useState(false);

  const [small, setSmall] = useState<SmallState | null>(null);
  const [ventText, setVentText] = useState('');
  const [ventSaved, setVentSaved] = useState(false);
  const [companyChoice, setCompanyChoice] = useState<string | null>(null);
  const [companyDone, setCompanyDone] = useState(false);
  const [distractChoice, setDistractChoice] = useState<string | null>(null);
  const [distractDone, setDistractDone] = useState(false);

  const [sheet, setSheet] = useState<{ title: string; rows: SheetRow[] } | null>(null);
  const [toast, setToast] = useState('');
  const [summaryHidden, setSummaryHidden] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    const verify = async () => {
      if (!tokenStorage.getAccess()) {
        router.replace('/login');
        return;
      }

      try {
        const [characterRes, latestRes] = await Promise.all([
          authFetch(`${API_URL}/characters/me`),
          listEmotionalLogs({ limit: 1 }),
        ]);

        if (characterRes.status === 401) {
          tokenStorage.clear();
          router.replace('/login');
          return;
        }
        if (characterRes.status === 404) {
          router.replace('/onboarding');
          return;
        }
        if (characterRes.ok) setCharacter(await characterRes.json());

        if (latestRes.status === 'ok') {
          const latest = latestRes.data.items[0];
          if (latest) setLatestMood({ name: latest.emotion.name, intensity: latest.intensity });
        }
      } catch (err) {
        console.error('Error verificando sesión', err);
      } finally {
        setLoading(false);
      }
    };

    void verify();
  }, [router]);

  const resetToLibrary = useCallback(() => {
    setView('library');
    setCompletion(null);
    setReflection('');
    setActivityError('');
    setBreath({
      stage: 'intro',
      remaining: 60,
      phase: 0,
      phaseRemaining: BREATH_PHASES[0].seconds,
      paused: false,
      calmBefore: 5,
      effect: null,
    });
    breathSavedRef.current = false;
    setUnravel({ step: 0, answers: EMPTY_ANSWERS });
    setUnravelDone(false);
    setSmall(null);
    setVentText('');
    setVentSaved(false);
    setCompanyChoice(null);
    setCompanyDone(false);
    setDistractChoice(null);
    setDistractDone(false);
  }, []);

  const openActivity = useCallback(
    (next: View) => {
      resetToLibrary();
      setView(next);
    },
    [resetToLibrary],
  );

  const loadPendingSteps = useCallback(async () => {
    const result = await listCareActivities();
    if (result.status !== 'ok') return;
    setPendingSteps(
      result.data.items.filter((item) => item.activity === 'SMALL_STEP' && item.status === 'PLANNED'),
    );
  }, []);

  useEffect(() => {
    if (!loading) void loadPendingSteps();
  }, [loading, loadPendingSteps]);

  const recordActivity = useCallback(
    async (
      activity: CareActivityType,
      payload: {
        status?: CareActivityStatus;
        reflection?: string;
        outcome?: CareOutcome;
        metadata?: Record<string, unknown>;
      } = {},
    ): Promise<Completion | null> => {
      setSavingActivity(true);
      setActivityError('');

      const result = await createCareActivity({
        activity,
        status: payload.status ?? 'COMPLETED',
        ...(payload.reflection ? { reflection: payload.reflection } : {}),
        ...(payload.outcome ? { outcome: payload.outcome } : {}),
        ...(payload.metadata ? { metadata: payload.metadata } : {}),
      });

      setSavingActivity(false);

      if (result.status !== 'ok') {
        setActivityError(result.message);
        notify(result.message);
        return null;
      }

      if (result.data.status === 'COMPLETED') {
        const nextCompletion: Completion = {
          id: result.data.id,
          awarded: result.data.treeDropAwarded === true,
          reflectionSaved: Boolean(result.data.reflection),
        };
        setCompletion(nextCompletion);
        return nextCompletion;
      }

      return null;
    },
    [notify],
  );

  useEffect(() => {
    if (view !== 'calm' || breath.stage !== 'running' || breath.paused) return;

    const timer = setInterval(() => {
      setBreath((prev) => {
        if (prev.remaining <= 1) return { ...prev, remaining: 0 };

        const nextPhaseRemaining = prev.phaseRemaining - 1;
        if (nextPhaseRemaining <= 0) {
          const nextPhase = (prev.phase + 1) % BREATH_PHASES.length;
          return {
            ...prev,
            remaining: prev.remaining - 1,
            phase: nextPhase,
            phaseRemaining: BREATH_PHASES[nextPhase].seconds,
          };
        }

        return { ...prev, remaining: prev.remaining - 1, phaseRemaining: nextPhaseRemaining };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [view, breath.stage, breath.paused]);

  useEffect(() => {
    if (view !== 'calm' || breath.stage !== 'running' || breath.remaining > 0) return;
    setBreath((prev) => ({ ...prev, stage: 'done' }));
  }, [view, breath.stage, breath.remaining]);

  useEffect(() => {
    if (view !== 'calm' || breath.stage !== 'done' || breathSavedRef.current) return;
    breathSavedRef.current = true;
    void recordActivity('BREATHING', {
      metadata: {
        calmBefore: breath.calmBefore,
        seconds: Math.max(0, 60 - breath.remaining),
      },
    }).then((saved) => {
      if (!saved) breathSavedRef.current = false;
    });
  }, [view, breath.stage, breath.calmBefore, breath.remaining, recordActivity]);

  const logout = useCallback(async () => {
    await endSession();
    router.push('/login');
  }, [router]);

  const openAccount = () => {
    setSheet({
      title: 'Tu cuenta',
      rows: [
        { label: 'Ir al Feed', icon: 'home', onClick: () => router.push('/feed') },
        { label: 'Mis relatos', icon: 'book', onClick: () => router.push('/mis-relatos') },
        { label: 'Mi perfil', icon: 'user', onClick: () => router.push('/cuenta') },
        { label: 'Mis reportes', icon: 'flag', onClick: () => router.push('/mis-reportes') },
        { label: 'Ayuda y soporte', icon: 'mail', onClick: () => router.push('/soporte') },
        {
          label: 'Privacidad y configuración',
          icon: 'settings',
          onClick: () => router.push('/cuenta/configuracion'),
        },
        { label: 'Cerrar sesión', icon: 'user', danger: true, onClick: () => void logout() },
      ],
    });
  };

  const navigate = (route: WyRoute) => {
    switch (route) {
      case 'home':
        router.push('/feed');
        break;
      case 'mood':
        router.push('/mi-espacio');
        break;
      case 'pulso':
        router.push('/pulso');
        break;
      case 'tree':
        router.push('/mi-arbol');
        break;
      case 'my-stories':
        router.push('/mis-relatos');
        break;
      case 'following':
        router.push('/siguiendo');
        break;
      case 'explore':
        router.push('/explorar');
        break;
      case 'profile':
        router.push('/cuenta');
        break;
      case 'notifications':
        router.push('/notificaciones');
        break;
      case 'help':
        router.push('/ayuda');
        break;
      default:
        notify('Esta sección llega con los próximos módulos.');
    }
  };

  const startBreathing = () => {
    breathSavedRef.current = false;
    setCompletion(null);
    setReflection('');
    setActivityError('');
    setBreath((prev) => ({
      ...prev,
      stage: 'running',
      remaining: 60,
      phase: 0,
      phaseRemaining: BREATH_PHASES[0].seconds,
      paused: false,
      effect: null,
    }));
  };

  const finishBreathing = () => {
    setBreath((prev) => ({ ...prev, stage: 'done' }));
  };

  const chooseBreathEffect = async (outcome: CareOutcome) => {
    setBreath((prev) => ({ ...prev, effect: outcome }));
    if (!completion) return;

    setSavingActivity(true);
    const result = await updateCareActivity(completion.id, { outcome });
    setSavingActivity(false);

    if (result.status !== 'ok') {
      setActivityError(result.message);
      return;
    }

    setCompletion({
      ...completion,
      awarded: completion.awarded || result.data.treeDropAwarded === true,
    });
    notify('Respuesta guardada solo para ti.');
  };

  const saveReflection = async () => {
    if (!completion) return;
    const text = reflection.trim();
    if (!text) {
      setActivityError('Escribe una reflexión o elige “Ahora no”.');
      return;
    }

    setSavingReflection(true);
    setActivityError('');
    const result = await updateCareActivity(completion.id, { reflection: text });
    setSavingReflection(false);

    if (result.status !== 'ok') {
      setActivityError(result.message);
      return;
    }

    setCompletion({
      ...completion,
      awarded: completion.awarded || result.data.treeDropAwarded === true,
      reflectionSaved: true,
    });
    notify('Reflexión guardada solo para ti.');
  };

  const chooseUnravel = (key: keyof UnravelAnswers, value: string) => {
    const answers = { ...unravel.answers, [key]: value };

    if (unravel.step < UNRAVEL_STEPS.length - 1) {
      setUnravel({ step: unravel.step + 1, answers });
      return;
    }

    setUnravel({ step: unravel.step, answers });
    setUnravelDone(true);
    void recordActivity('UNRAVEL', {
      metadata: {
        feeling: latestMood?.name ?? 'Neutral',
        ...answers,
      },
    });
  };

  const chooseSmall = (action: string) => {
    setSmall({ action, plannedId: null, completed: false, awarded: false });
    setCompletion(null);
    setReflection('');
    setActivityError('');
  };

  const planSmall = async () => {
    if (!small) return;
    setSavingActivity(true);
    setActivityError('');
    const result = await createCareActivity({
      activity: 'SMALL_STEP',
      status: 'PLANNED',
      metadata: { action: small.action },
    });
    setSavingActivity(false);

    if (result.status !== 'ok') {
      setActivityError(result.message);
      return;
    }

    setSmall({ ...small, plannedId: result.data.id });
    void loadPendingSteps();
    notify('Paso guardado para ahora.');
  };

  const completePlannedSmall = async () => {
    if (!small?.plannedId) return;
    setSavingActivity(true);
    setActivityError('');
    const result = await updateCareActivity(small.plannedId, { status: 'COMPLETED' });
    setSavingActivity(false);

    if (result.status !== 'ok') {
      setActivityError(result.message);
      return;
    }

    const nextCompletion: Completion = {
      id: result.data.id,
      awarded: result.data.treeDropAwarded === true,
      reflectionSaved: Boolean(result.data.reflection),
    };
    setCompletion(nextCompletion);
    setSmall({ ...small, completed: true, awarded: nextCompletion.awarded });
    void loadPendingSteps();
    notify('Paso completado. Tu árbol recibió una gota de cuidado.');
  };

  const completePendingStep = async (activity: CareActivity) => {
    setSavingActivity(true);
    setActivityError('');
    const result = await updateCareActivity(activity.id, { status: 'COMPLETED' });
    setSavingActivity(false);

    if (result.status !== 'ok') {
      setActivityError(result.message);
      notify(result.message);
      return;
    }

    const nextCompletion: Completion = {
      id: result.data.id,
      awarded: result.data.treeDropAwarded === true,
      reflectionSaved: Boolean(result.data.reflection),
    };
    setCompletion(nextCompletion);
    setReflection('');
    setSmall({
      action: pendingAction(activity),
      plannedId: activity.id,
      completed: true,
      awarded: nextCompletion.awarded,
    });
    setView('small');
    void loadPendingSteps();
    notify('Paso completado. Tu árbol recibió una gota de cuidado.');
  };

  const completeSmallNow = async () => {
    if (!small) return;
    const nextCompletion = await recordActivity('SMALL_STEP', {
      metadata: { action: small.action },
    });
    if (nextCompletion) setSmall({ ...small, completed: true, awarded: nextCompletion.awarded });
  };

  const saveVent = async () => {
    const text = ventText.trim();
    if (!text) {
      setActivityError('Escribe aunque sea una línea. No tiene que estar ordenado.');
      return;
    }

    setSavingActivity(true);
    setActivityError('');
    const result = await createCareActivity({
      activity: 'VENT',
      reflection: text,
      metadata: { private: true },
    });
    setSavingActivity(false);

    if (result.status !== 'ok') {
      setActivityError(result.message);
      return;
    }

    const nextCompletion: Completion = {
      id: result.data.id,
      awarded: result.data.treeDropAwarded === true,
      reflectionSaved: true,
    };
    setCompletion(nextCompletion);
    setVentSaved(true);
    setVentText('');
    notify('Guardado solo para ti.');
  };

  const completeCompany = async () => {
    const nextCompletion = await recordActivity('COMPANY', {
      metadata: { choice: companyChoice },
    });
    if (nextCompletion) setCompanyDone(true);
  };

  const completeDistract = async () => {
    const nextCompletion = await recordActivity('DISTRACT', {
      metadata: { choice: distractChoice },
    });
    if (nextCompletion) setDistractDone(true);
  };

  const copyCompanionMessage = async () => {
    const message = 'Estoy teniendo un momento difícil. ¿Puedes acompañarme un rato?';
    try {
      await navigator.clipboard.writeText(message);
      notify('Mensaje copiado. Puedes pegarlo donde quieras.');
    } catch {
      notify('No se pudo copiar. Puedes escribir el mensaje tú.');
    }
  };

  const phase = BREATH_PHASES[breath.phase] ?? BREATH_PHASES[0];
  const elapsed = 60 - breath.remaining;
  const unravelFeeling = latestMood?.name ?? 'Neutral';

  if (loading) {
    return (
      <PageSkeleton variant="grid" />
    );
  }

  const renderLibrary = () => (
    <>
      <section className="support-hero card space-description">
        <div>
          <span className="micro-label">SOLO PARA TI · OPCIONAL</span>
          <h1>Cuidarme</h1>
          <p>
            Respira, ordena tus ideas o elige un pequeño paso. Puedes usar estas actividades sin registrar una
            emoción.
          </p>
        </div>
        <button className="guide-btn" type="button" onClick={() => setGuideOpen(true)} aria-label="Cómo usar Cuidarme">
          <Icon name="help" />
          <span>Cómo usarlo</span>
        </button>
      </section>

      {pendingSteps.length ? (
        <section className="care-pending card">
          <div className="care-section-heading">
            <div>
              <span className="micro-label">TUS PASOS PENDIENTES</span>
              <h2>Lo que elegiste para después</h2>
              <p>Puedes retomarlo cuando quieras. No hay prisa.</p>
            </div>
          </div>
          <div className="care-pending-list">
            {pendingSteps.map((step) => (
              <div className="care-pending-row" key={step.id}>
                <div>
                  <b>{pendingAction(step)}</b>
                  <small>Guardado para cuando puedas.</small>
                </div>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => void completePendingStep(step)}
                  disabled={savingActivity}
                >
                  Ya lo hice
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="section-heading">
        <div>
          <span className="micro-label">EXPERIENCIAS INTERACTIVAS</span>
          <h2>Elige una actividad breve</h2>
          <p>Elige lo que te venga bien en este momento.</p>
        </div>
      </div>

      <div className="experience-grid">
        <button type="button" onClick={() => openActivity('calm')}>
          <span>🌬️</span>
          <div>
            <small>1 MINUTO</small>
            <b>Calma tu mente</b>
            <p>Una pausa visual para bajar el ritmo.</p>
          </div>
          <em>Comenzar</em>
        </button>
        <button type="button" onClick={() => openActivity('thoughts')}>
          <span>🧩</span>
          <div>
            <small>2 MINUTOS</small>
            <b>Desenreda lo que sientes</b>
            <p>Ordena origen, necesidad y próximo paso.</p>
          </div>
          <em>Comenzar</em>
        </button>
        <button type="button" onClick={() => openActivity('small')}>
          <span>👣</span>
          <div>
            <small>1 MINUTO</small>
            <b>Un paso posible</b>
            <p>Elige una acción pequeña para este momento.</p>
          </div>
          <em>Comenzar</em>
        </button>
      </div>

      <section className="other-support card">
        <div className="section-heading">
          <div>
            <h2>Otras formas de cuidarte</h2>
          </div>
        </div>
        <div className="support-rows">
          <button type="button" onClick={() => openActivity('vent')}>
            <span>✍️</span>
            <div>
              <b>Desahogarme en privado</b>
              <small>Escribe sin publicar nada.</small>
            </div>
            <Icon name="chevron" />
          </button>
          <button type="button" onClick={() => openActivity('company')}>
            <span>🫶</span>
            <div>
              <b>Sentirme acompañado</b>
              <small>Encuentra opciones de apoyo seguro.</small>
            </div>
            <Icon name="chevron" />
          </button>
          <button type="button" onClick={() => openActivity('distract')}>
            <span>🎧</span>
            <div>
              <b>Cambiar de foco</b>
              <small>Toma distancia durante unos minutos.</small>
            </div>
            <Icon name="chevron" />
          </button>
        </div>
      </section>

      <section className="safety-inline card">
        <div>
          <Icon name="shield" />
        </div>
        <div>
          <b>¿Necesitas ayuda inmediata o no te sientes a salvo?</b>
          <p>Withyouly acompaña, pero no reemplaza atención profesional o servicios de emergencia.</p>
        </div>
        <button className="secondary" type="button" onClick={() => router.push('/ayuda')}>
          Ver ayuda y seguridad
        </button>
      </section>
    </>
  );

  const renderBreathCompletion = () => (
    <section className="care-panel card care-completion">
      <button className="ghost care-back" type="button" onClick={resetToLibrary}>
        <Icon name="chevron" /> Volver a actividades
      </button>
      <div className="care-check">
        <Icon name="check" />
      </div>
      <span className="micro-label">PAUSA COMPLETADA</span>
      <h2>Te acompañaste durante un minuto</h2>
      <p>No necesitas sentirte perfectamente bien. Observa solamente si algo cambió, aunque sea un poco.</p>

      <div className="care-before-after">
        <span>
          Antes <b>{breath.calmBefore}/10</b>
        </span>
        <i />
        <span>
          Ahora <b>¿cómo estás?</b>
        </span>
      </div>

      <div className="care-effect-buttons">
        {EFFECTS.map((effect) => (
          <button
            key={effect.value}
            className={breath.effect === effect.value ? 'selected' : undefined}
            type="button"
            onClick={() => void chooseBreathEffect(effect.value)}
            disabled={savingActivity || !completion}
          >
            {effect.label}
          </button>
        ))}
      </div>

      {!completion && savingActivity ? <p className="care-note">Guardando tu reconocimiento…</p> : null}

      <Recognition activity="BREATHING" completion={completion} />

      <ReflectionEditor
        value={reflection}
        onChange={setReflection}
        onSave={() => void saveReflection()}
        saving={savingReflection}
        saved={completion?.reflectionSaved === true}
        disabled={!completion}
        placeholder="¿Qué quieres recordar de esta pausa?"
      />

      {activityError ? (
        <div className="auth-error" role="alert">
          {activityError}
        </div>
      ) : null}

      <div className="care-actions">
        <button className="secondary" type="button" onClick={() => openActivity('calm')}>
          Repetir la actividad
        </button>
        <button className="ghost" type="button" onClick={resetToLibrary}>
          Volver a actividades
        </button>
      </div>
    </section>
  );

  const renderCalm = () => {
    if (breath.stage === 'done') return renderBreathCompletion();

    if (breath.stage === 'running') {
      return (
        <section className="care-panel card">
          <div className="breath-top">
            <button className="ghost" type="button" onClick={resetToLibrary}>
              Salir
            </button>
            <div>
              <span className="micro-label">CALMA TU MENTE · 1 MINUTO</span>
              <b>{formatClock(breath.remaining)}</b>
            </div>
          </div>

          <div className={`breath-orb ${phase.key}`}>
            <div className="breath-rings">
              <i />
              <i />
              <i />
              <div className="breath-core">
                <strong>{phase.label}</strong>
                <span>{breath.phaseRemaining}</span>
              </div>
            </div>
          </div>

          <p className="breath-cue">{phase.cue}</p>
          <div className="breath-progress">
            <i style={{ width: `${Math.min(100, (elapsed / 60) * 100)}%` }} />
          </div>

          <div className="breath-controls">
            <button className="secondary" type="button" onClick={() => setBreath((prev) => ({ ...prev, paused: !prev.paused }))}>
              {breath.paused ? 'Continuar' : 'Pausar'}
            </button>
            <button className="ghost" type="button" onClick={finishBreathing}>
              Terminar por ahora
            </button>
          </div>

          <div className="body-reminders">
            <span>Afloja la mandíbula</span>
            <span>Baja los hombros</span>
            <span>Respira sin forzar</span>
          </div>
          <div className="comfort-note">
            <Icon name="heart" /> Si te mareas o te incomoda, vuelve a tu respiración natural y detén la actividad.
          </div>
        </section>
      );
    }

    return (
      <section className="care-panel card">
        <button className="ghost care-back" type="button" onClick={resetToLibrary}>
          <Icon name="chevron" /> Volver a actividades
        </button>
        <div className="care-context-line">
          {latestMood ? (
            <>
              {moodEmoji(latestMood.name)} Recomendación relacionada con tu registro de <b>{latestMood.name}</b>
            </>
          ) : (
            'Una recomendación para este momento.'
          )}
        </div>
        <div className="breath-title">
          <div className="care-symbol">
            <Icon name="pulse" />
          </div>
          <div>
            <span className="micro-label">1 MINUTO · PRIVADO</span>
            <h2>Calma tu mente</h2>
            <p>Una pausa breve y visual para reducir el ritmo antes de continuar. Puedes detenerla en cualquier momento.</p>
          </div>
        </div>

        <div className="calm-check">
          <label htmlFor="calmBefore">
            <span>Antes de comenzar</span>
            <b>
              ¿Qué tan intensa se siente la emoción? <em>{breath.calmBefore}/10</em>
            </b>
          </label>
          <input
            id="calmBefore"
            type="range"
            min={1}
            max={10}
            value={breath.calmBefore}
            onChange={(event) => setBreath((prev) => ({ ...prev, calmBefore: Number(event.target.value) }))}
          />
        </div>

        <div className="breath-sequence">
          <div>
            <span>1</span>
            <b>Inhala</b>
            <small>4 segundos</small>
          </div>
          <div>
            <span>2</span>
            <b>Pausa</b>
            <small>2 segundos</small>
          </div>
          <div>
            <span>3</span>
            <b>Exhala</b>
            <small>6 segundos</small>
          </div>
        </div>

        <button className="primary breath-start" type="button" onClick={startBreathing}>
          Comenzar 1 minuto
        </button>
        <button className="text-link alternative-calm" type="button" onClick={() => openActivity('thoughts')}>
          Prefiero ordenar mis ideas
        </button>
      </section>
    );
  };

  const renderThoughts = () => {
    if (unravelDone) {
      return (
        <section className="care-panel card care-completion">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a las ayudas
          </button>
          <div className="care-check">
            <Icon name="sparkle" />
          </div>
          <span className="micro-label">RECORRIDO COMPLETADO · SOLO PARA TI</span>
          <h2>Desenredaste lo que estabas sintiendo</h2>
          <p>No solucionaste todo: separaste las piezas para que resulte más fácil decidir qué necesitas.</p>

          <div className="care-summary">
            <div>
              <small>Siento</small>
              <b>{unravelFeeling}</b>
            </div>
            <div>
              <small>Puede venir de</small>
              <b>{unravel.answers.origin}</b>
            </div>
            <div>
              <small>Necesito</small>
              <b>{unravel.answers.need}</b>
            </div>
            <div>
              <small>Mi paso pequeño</small>
              <b>{unravel.answers.action}</b>
            </div>
          </div>

          <Recognition activity="UNRAVEL" completion={completion} />

          <button
            className="text-link care-use-summary"
            type="button"
            onClick={() => setReflection(unravelReflection(unravelFeeling, unravel.answers))}
          >
            Usar este resumen como reflexión
          </button>

          <ReflectionEditor
            value={reflection}
            onChange={setReflection}
            onSave={() => void saveReflection()}
            saving={savingReflection}
            saved={completion?.reflectionSaved === true}
            disabled={!completion}
            placeholder="¿Qué quieres recordar de este recorrido?"
          />

          {activityError ? (
            <div className="auth-error" role="alert">
              {activityError}
            </div>
          ) : null}

          <div className="care-actions">
            <button className="secondary" type="button" onClick={() => openActivity('thoughts')}>
              Volver a empezar
            </button>
            <button className="ghost" type="button" onClick={resetToLibrary}>
              Volver a actividades
            </button>
          </div>
          <div className="care-note">
            <Icon name="lock" /> Tus respuestas son privadas. Esta actividad orienta una pausa de reflexión; no diagnostica ni reemplaza apoyo profesional.
          </div>
        </section>
      );
    }

    const step = UNRAVEL_STEPS[unravel.step] ?? UNRAVEL_STEPS[0];
    const selected = unravel.answers[step.key];

    return (
      <section className="care-panel card">
        <div className="care-panel-head">
          <button
            className="ghost care-back"
            type="button"
            onClick={() => {
              if (unravel.step === 0) resetToLibrary();
              else setUnravel((prev) => ({ ...prev, step: prev.step - 1 }));
            }}
          >
            <Icon name="chevron" /> {unravel.step === 0 ? 'Volver a actividades' : 'Anterior'}
          </button>
          <span className="privacy-badge">
            <Icon name="lock" /> Privado
          </span>
        </div>

        <div className="care-context-line">
          {latestMood ? (
            <>
              {moodEmoji(latestMood.name)} Partimos de tu registro: <b>{latestMood.name} · {latestMood.intensity}/10</b>
            </>
          ) : (
            'Partimos de este momento, sin necesidad de un registro previo.'
          )}
        </div>

        <div className="care-panel-title">
          <div className="care-symbol">
            <Icon name="book" />
          </div>
          <div>
            <span className="micro-label">EXPERIENCIA INTERACTIVA · 2 MINUTOS</span>
            <h2>Desenreda lo que sientes</h2>
            <p>Ya sabemos cómo te sientes. Ahora separaremos el posible origen, lo que necesitas y un paso pequeño.</p>
          </div>
        </div>

        <div className="unravel-progress" aria-label={`Paso ${unravel.step + 1} de 3`}>
          {UNRAVEL_STEPS.map((item, index) => (
            <i key={item.key} className={index <= unravel.step ? 'active' : undefined} />
          ))}
        </div>

        <div className="unravel-question">
          <span className="micro-label">{step.eyebrow}</span>
          <h3>{step.title}</h3>
          <p>{step.copy}</p>
        </div>

        <div className="care-choice-grid">
          {step.choices.map((choice) => (
            <button
              key={choice.label}
              className={selected === choice.label ? 'selected' : undefined}
              type="button"
              onClick={() => chooseUnravel(step.key, choice.label)}
            >
              <span>
                <Icon name={choice.icon} />
              </span>
              <b>{choice.label}</b>
            </button>
          ))}
        </div>

        <div className="care-note">Puedes salir cuando quieras. No hay respuestas correctas ni puntos por sentirte de una manera determinada.</div>
      </section>
    );
  };

  const renderSmall = () => {
    if (small?.completed) {
      return (
        <section className="care-panel card care-completion">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <div className="care-check">
            <Icon name="check" />
          </div>
          <span className="micro-label">TU PASO POSIBLE</span>
          <h2>{small.action}</h2>
          <p>No tiene que cambiar todo tu día. Lo importante es que sea una acción posible para ti ahora.</p>

          <Recognition activity="SMALL_STEP" completion={completion} />

          <ReflectionEditor
            value={reflection}
            onChange={setReflection}
            onSave={() => void saveReflection()}
            saving={savingReflection}
            saved={completion?.reflectionSaved === true}
            disabled={!completion}
            placeholder="¿Qué quieres recordar de este paso?"
          />

          {activityError ? (
            <div className="auth-error" role="alert">
              {activityError}
            </div>
          ) : null}

          <div className="care-actions">
            <button className="secondary" type="button" onClick={() => setSmall(null)}>
              Elegir otro paso
            </button>
            <button className="ghost" type="button" onClick={resetToLibrary}>
              Volver a actividades
            </button>
          </div>
        </section>
      );
    }

    if (small?.plannedId) {
      return (
        <section className="care-panel card care-completion">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <div className="care-check care-check-planned">
            <Icon name="calendar" />
          </div>
          <span className="micro-label">PASO GUARDADO</span>
          <h2>{small.action}</h2>
          <p>Lo guardamos para que no se te pierda. Cuando lo hayas hecho, vuelve y márcalo.</p>

          {activityError ? (
            <div className="auth-error" role="alert">
              {activityError}
            </div>
          ) : null}

          <div className="care-actions">
            <button className="primary" type="button" onClick={() => void completePlannedSmall()} disabled={savingActivity}>
              {savingActivity ? 'Guardando…' : 'Ya lo hice'}
            </button>
            <button className="secondary" type="button" onClick={() => setSmall(null)}>
              Elegir otro paso
            </button>
            <button className="ghost" type="button" onClick={resetToLibrary}>
              Volver a actividades
            </button>
          </div>
        </section>
      );
    }

    if (small) {
      return (
        <section className="care-panel card care-completion">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <div className="care-check">
            <Icon name="check" />
          </div>
          <span className="micro-label">TU PASO POSIBLE</span>
          <h2>{small.action}</h2>
          <p>No tiene que cambiar todo tu día. Lo importante es que sea una acción posible para ti ahora.</p>

          {activityError ? (
            <div className="auth-error" role="alert">
              {activityError}
            </div>
          ) : null}

          <div className="care-actions">
            <button className="primary" type="button" onClick={() => void planSmall()} disabled={savingActivity}>
              {savingActivity ? 'Guardando…' : 'Lo haré ahora'}
            </button>
            <button className="secondary" type="button" onClick={() => void completeSmallNow()} disabled={savingActivity}>
              Ya lo hice
            </button>
            <button className="ghost" type="button" onClick={() => setSmall(null)}>
              Elegir otro paso
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="care-panel card">
        <div className="care-panel-head">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <span className="privacy-badge">
            <Icon name="lock" /> Privado
          </span>
        </div>

        <div className="care-context-line">
          {latestMood ? (
            <>
              {moodEmoji(latestMood.name)} Sugerido después de registrar <b>{latestMood.name} · {latestMood.intensity}/10</b>
            </>
          ) : (
            'Una sugerencia para este momento.'
          )}
        </div>

        <div className="care-panel-title">
          <div className="care-symbol">
            <Icon name="check" />
          </div>
          <div>
            <span className="micro-label">EXPERIENCIA INTERACTIVA · 1 MINUTO</span>
            <h2>Un paso posible</h2>
            <p>Cuando todo parece demasiado, elige solamente una acción pequeña. No hay obligación de completar ninguna.</p>
          </div>
        </div>

        <div className="care-choice-grid care-choice-grid-small">
          {SMALL_OPTIONS.map((option) => (
            <button key={option.label} type="button" onClick={() => chooseSmall(option.label)}>
              <span>
                <Icon name={option.icon} />
              </span>
              <b>{option.label}</b>
            </button>
          ))}
        </div>

        <div className="care-note">Tu elección es privada. Puedes cambiarla o salir en cualquier momento.</div>
      </section>
    );
  };

  const renderVent = () => {
    if (ventSaved) {
      return (
        <section className="care-panel card care-completion">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <div className="care-check">
            <Icon name="check" />
          </div>
          <span className="micro-label">DESAHOGO PRIVADO</span>
          <h2>Tu nota quedó guardada</h2>
          <p>No se publicó en la comunidad. Puedes volver a escribir cuando lo necesites.</p>

          <Recognition activity="VENT" completion={completion} />

          <div className="care-actions">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                setVentSaved(false);
                setCompletion(null);
                setVentText('');
                setActivityError('');
              }}
            >
              Escribir otra nota
            </button>
            <button className="ghost" type="button" onClick={resetToLibrary}>
              Volver a actividades
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="care-panel card">
        <div className="care-panel-head">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <span className="privacy-badge">
            <Icon name="lock" /> Privado
          </span>
        </div>

        <div className="care-panel-title">
          <div className="care-symbol">
            <Icon name="message" />
          </div>
          <div>
            <span className="micro-label">SIN LÍMITE · SOLO PARA TI</span>
            <h2>Desahogarme en privado</h2>
            <p>Escribe primero en privado. Al terminar tú decides si guardarlo o descartarlo.</p>
          </div>
        </div>

        <label className="field-label" htmlFor="ventText">
          Lo que quiero soltar
        </label>
        <textarea
          id="ventText"
          className="field care-vent-text"
          value={ventText}
          maxLength={5000}
          onChange={(event) => setVentText(event.target.value)}
          placeholder="No tiene que estar ordenado. Puedes escribirlo tal como aparece."
        />

        {activityError ? (
          <div className="auth-error" role="alert">
            {activityError}
          </div>
        ) : null}

        <div className="care-actions">
          <button className="primary" type="button" onClick={() => void saveVent()} disabled={savingActivity}>
            {savingActivity ? 'Guardando…' : 'Guardar solo para mí'}
          </button>
          <button className="ghost" type="button" onClick={resetToLibrary}>
            Descartar y volver
          </button>
        </div>

        <div className="care-note">
          <Icon name="lock" /> No se publica en la comunidad. Solo tú puedes verlo.
        </div>
      </section>
    );
  };

  const renderCompany = () => {
    if (companyDone) {
      return (
        <section className="care-panel card care-completion">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <div className="care-check">
            <Icon name="heart" />
          </div>
          <span className="micro-label">COMPAÑÍA</span>
          <h2>Buscaste acompañamiento</h2>
          <p>No tienes que sostenerlo todo en soledad. Elegir a quién acercarte también es cuidarte.</p>

          <Recognition activity="COMPANY" completion={completion} />

          <ReflectionEditor
            value={reflection}
            onChange={setReflection}
            onSave={() => void saveReflection()}
            saving={savingReflection}
            saved={completion?.reflectionSaved === true}
            disabled={!completion}
            placeholder="¿Qué quieres recordar de este momento?"
          />

          {activityError ? (
            <div className="auth-error" role="alert">
              {activityError}
            </div>
          ) : null}

          <div className="care-actions">
            <button className="secondary" type="button" onClick={() => openActivity('company')}>
              Ver opciones otra vez
            </button>
            <button className="ghost" type="button" onClick={resetToLibrary}>
              Volver a actividades
            </button>
          </div>
        </section>
      );
    }

    const selected = COMPANY_OPTIONS.find((option) => option.key === companyChoice);

    return (
      <section className="care-panel card">
        <div className="care-panel-head">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <span className="privacy-badge">
            <Icon name="lock" /> Privado
          </span>
        </div>

        <div className="care-panel-title">
          <div className="care-symbol">
            <Icon name="heart" />
          </div>
          <div>
            <span className="micro-label">A TU RITMO</span>
            <h2>Sentirme acompañado</h2>
            <p>Puedes contactar a alguien de confianza, leer un relato moderado o buscar recursos de apoyo.</p>
          </div>
        </div>

        <div className="care-option-grid">
          {COMPANY_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={companyChoice === option.key ? 'selected' : undefined}
              type="button"
              onClick={() => setCompanyChoice(option.key)}
            >
              <span>
                <Icon name={option.icon} />
              </span>
              <div>
                <b>{option.title}</b>
                <small>{option.copy}</small>
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="care-option-action">
            <button
              className="secondary"
              type="button"
              onClick={() => {
                if (selected.key === 'read') router.push('/explorar');
                else if (selected.key === 'resources') router.push('/soporte');
                else void copyCompanionMessage();
              }}
            >
              {selected.action}
            </button>
            {selected.key === 'message' ? (
              <small>“Estoy teniendo un momento difícil. ¿Puedes acompañarme un rato?”</small>
            ) : null}
          </div>
        ) : null}

        {activityError ? (
          <div className="auth-error" role="alert">
            {activityError}
          </div>
        ) : null}

        <div className="care-actions">
          <button className="primary" type="button" onClick={() => void completeCompany()} disabled={savingActivity}>
            {savingActivity ? 'Guardando…' : 'Ya lo hice'}
          </button>
          <button className="ghost" type="button" onClick={resetToLibrary}>
            Volver a actividades
          </button>
        </div>

        <div className="care-note">
          <Icon name="shield" /> Si estás en peligro o no te sientes a salvo, busca ayuda inmediata. Withyouly no reemplaza servicios de emergencia.
        </div>
      </section>
    );
  };

  const renderDistract = () => {
    if (distractDone) {
      return (
        <section className="care-panel card care-completion">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <div className="care-check">
            <Icon name="music" />
          </div>
          <span className="micro-label">CAMBIO DE FOCO</span>
          <h2>Te diste unos minutos</h2>
          <p>Tomar distancia a propósito también puede ser una forma de bajar el ritmo.</p>

          <Recognition activity="DISTRACT" completion={completion} />

          <ReflectionEditor
            value={reflection}
            onChange={setReflection}
            onSave={() => void saveReflection()}
            saving={savingReflection}
            saved={completion?.reflectionSaved === true}
            disabled={!completion}
            placeholder="¿Qué quieres recordar de este momento?"
          />

          {activityError ? (
            <div className="auth-error" role="alert">
              {activityError}
            </div>
          ) : null}

          <div className="care-actions">
            <button className="secondary" type="button" onClick={() => openActivity('distract')}>
              Ver opciones otra vez
            </button>
            <button className="ghost" type="button" onClick={resetToLibrary}>
              Volver a actividades
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="care-panel card">
        <div className="care-panel-head">
          <button className="ghost care-back" type="button" onClick={resetToLibrary}>
            <Icon name="chevron" /> Volver a actividades
          </button>
          <span className="privacy-badge">
            <Icon name="lock" /> Privado
          </span>
        </div>

        <div className="care-panel-title">
          <div className="care-symbol">
            <Icon name="music" />
          </div>
          <div>
            <span className="micro-label">5 MINUTOS</span>
            <h2>Cambiar de foco</h2>
            <p>Elige una actividad breve que no te haga daño y te permita tomar distancia.</p>
          </div>
        </div>

        <div className="care-option-grid">
          {DISTRACT_OPTIONS.map((option) => (
            <button
              key={option.key}
              className={distractChoice === option.key ? 'selected' : undefined}
              type="button"
              onClick={() => setDistractChoice(option.key)}
            >
              <span>
                <Icon name={option.icon} />
              </span>
              <div>
                <b>{option.title}</b>
                <small>{option.copy}</small>
              </div>
            </button>
          ))}
        </div>

        {activityError ? (
          <div className="auth-error" role="alert">
            {activityError}
          </div>
        ) : null}

        <div className="care-actions">
          <button className="primary" type="button" onClick={() => void completeDistract()} disabled={savingActivity}>
            {savingActivity ? 'Guardando…' : 'Ya lo hice'}
          </button>
          <button className="ghost" type="button" onClick={resetToLibrary}>
            Volver a actividades
          </button>
        </div>

        <div className="care-note">No necesitas cronometrar. Basta con unos minutos y con elegir algo que no te exija más.</div>
      </section>
    );
  };

  return (
    <WyFrame
      characterInitials={initialsOf(character?.name)}
      avatarUrl={character?.avatarUrl}
      activeRoute="tree"
      onNavigate={navigate}
      onOpenAccount={openAccount}
      toast={toast}
      sheet={sheet ? <Sheet title={sheet.title} rows={sheet.rows} onClose={() => setSheet(null)} /> : null}
      rightRail={
        <RightRail
          summaryHidden={summaryHidden}
          onToggleSummary={() => setSummaryHidden((value) => !value)}
          onMood={() => router.push('/mi-estado')}
        />
      }
    >
      <section className="screen care-page">
        <MiEspacioNav active="care" />

        {view === 'library' ? renderLibrary() : null}
        {view === 'calm' ? renderCalm() : null}
        {view === 'thoughts' ? renderThoughts() : null}
        {view === 'small' ? renderSmall() : null}
        {view === 'vent' ? renderVent() : null}
        {view === 'company' ? renderCompany() : null}
        {view === 'distract' ? renderDistract() : null}


        {guideOpen ? (
          <div className="modal-layer">
            <Guide58Modal type="support" onClose={() => setGuideOpen(false)} />
          </div>
        ) : null}
      </section>
    </WyFrame>
  );
}
