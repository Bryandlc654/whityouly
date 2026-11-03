'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { uploadAudio } from '@/lib/files';

interface RecordedAudio {
  id: string;
  url: string;
  name: string;
  transcript: string;
}

interface Props {
  audioUrl: string | null;
  transcript: string;
  language?: string;
  disabled?: boolean;
  onRecorded: (audio: RecordedAudio) => void;
  onClear: () => void;
  onTranscriptChange: (value: string) => void;
}

interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechResultEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const MAX_TRANSCRIPT = 5000;

function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function speechConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const speechWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function supportedMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const options = ['audio/webm', 'audio/mp4', 'audio/ogg'];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'webm';
}

export default function AudioRecorder({
  audioUrl,
  transcript,
  language = 'es',
  disabled = false,
  onRecorded,
  onClear,
  onTranscriptChange,
}: Props) {
  const [speechSupported, setSpeechSupported] = useState(false);
  const [transcribe, setTranscribe] = useState(true);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [error, setError] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef('');
  const liveTranscriptRef = useRef('');
  const recordingRef = useRef(false);
  const transcribeRef = useRef(true);
  const mountedRef = useRef(true);

  useEffect(() => {
    setSpeechSupported(Boolean(speechConstructor()));
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current = false;
      recognitionRef.current?.abort();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopRecognition = () => {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
    }
  };

  const startRecognition = () => {
    const Recognition = speechConstructor();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'es' ? 'es-ES' : language === 'pt' ? 'pt-BR' : 'en-US';
    recognition.onresult = (event) => {
      let finalized = finalTranscriptRef.current;
      let interim = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript ?? '';
        if (result.isFinal) {
          finalized = `${finalized} ${text}`.replace(/\s+/g, ' ').trim();
        } else {
          interim = `${interim} ${text}`.replace(/\s+/g, ' ').trim();
        }
      }

      finalTranscriptRef.current = finalized;
      const visible = `${finalized} ${interim}`.replace(/\s+/g, ' ').trim();
      liveTranscriptRef.current = visible;
      setLiveTranscript(visible);
    };
    recognition.onerror = () => {
      // El audio sigue grabándose; la transcripción es opcional.
    };
    recognition.onend = () => {
      if (recordingRef.current && transcribeRef.current) {
        try {
          recognition.start();
        } catch {
          /* el navegador ya no permite reanudar */
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
    }
  };

  const finishRecording = async () => {
    const recorder = recorderRef.current;
    const mimeType = (recorder?.mimeType || 'audio/webm').split(';')[0];
    const transcriptText = (
      liveTranscriptRef.current || finalTranscriptRef.current
    ).trim();
    const chunks = chunksRef.current;

    recorderRef.current = null;
    recordingRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopRecognition();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!mountedRef.current) return;
    setRecording(false);
    setLiveTranscript(transcriptText);

    if (chunks.length === 0) {
      setError('No se recibió audio. Inténtalo de nuevo.');
      return;
    }

    const blob = new Blob(chunks, { type: mimeType });
    const extension = extensionFor(mimeType);
    const file = new File([blob], `grabacion-${Date.now()}.${extension}`, { type: mimeType });

    setUploading(true);
    setError('');
    const result = await uploadAudio(file);
    setUploading(false);

    if (!mountedRef.current) return;

    if (result.status === 'ok') {
      onRecorded({
        id: result.data.id,
        url: result.data.fileUrl,
        name: 'Grabación de voz',
        transcript: transcriptText,
      });
      return;
    }

    setError(result.message);
  };

  const startRecording = async () => {
    if (recording || starting || uploading || disabled) return;

    setError('');
    setLiveTranscript('');
    finalTranscriptRef.current = '';
    liveTranscriptRef.current = '';
    chunksRef.current = [];
    setStarting(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setStarting(false);
      setError('Este navegador no permite grabar audio. Puedes subir un archivo de audio.');
      return;
    }

    const mimeType = supportedMimeType();
    if (!mimeType) {
      setStarting(false);
      setError('Este navegador no puede grabar en un formato compatible. Sube un archivo de audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      streamRef.current = stream;
      recorderRef.current = recorder;
      recordingRef.current = true;
      transcribeRef.current = transcribe;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => void finishRecording();
      recorder.start(1000);

      setRecording(true);
      setStarting(false);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((value) => value + 1), 1000);

      if (transcribe) startRecognition();
    } catch (cause) {
      setStarting(false);
      const name = (cause as { name?: string } | null)?.name;
      setError(
        name === 'NotAllowedError'
          ? 'No hay permiso para usar el micrófono. Actívalo en tu navegador o sube un audio.'
          : 'No se pudo acceder al micrófono. Puedes subir un archivo de audio.',
      );
    }
  };

  const stopRecording = () => {
    recordingRef.current = false;
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  return (
    <div className="audio-recorder">
      <div className="audio-recorder-head">
        <div>
          <b>Audio</b>
          <span className="hint">
            Graba tu voz desde el navegador o sube un archivo. La transcripción es opcional.
          </span>
        </div>
        {audioUrl ? (
          <button className="text-link" type="button" onClick={onClear} disabled={disabled || recording}>
            Quitar audio
          </button>
        ) : null}
      </div>

      {audioUrl ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio controls src={audioUrl} className="post-audio" />
      ) : null}

      {recording ? (
        <div className="audio-recording" role="status" aria-live="polite">
          <span className="audio-recording-dot" aria-hidden />
          <b>Grabando {formatTime(elapsed)}</b>
          <button className="secondary sm" type="button" onClick={stopRecording}>
            Detener y guardar
          </button>
        </div>
      ) : (
        <div className="audio-recorder-actions">
          <button
            className={audioUrl ? 'ghost sm' : 'secondary sm'}
            type="button"
            onClick={() => void startRecording()}
            disabled={disabled || starting || uploading}
          >
            <Icon name="music" />
            {starting ? 'Abriendo micrófono...' : audioUrl ? 'Grabar de nuevo' : 'Grabar audio'}
          </button>
          {!audioUrl ? (
            <label className="audio-transcribe-toggle">
              <input
                type="checkbox"
                checked={transcribe && speechSupported}
                disabled={!speechSupported || disabled}
                onChange={(event) => setTranscribe(event.target.checked)}
              />
              Transcribir mientras grabo
            </label>
          ) : null}
        </div>
      )}

      {!speechSupported ? (
        <p className="hint audio-recorder-note">
          Este navegador no ofrece reconocimiento de voz. Puedes grabar igualmente y escribir la
          transcripción a mano.
        </p>
      ) : !audioUrl ? (
        <p className="hint audio-recorder-note">
          La transcripción usa el servicio de voz de tu navegador. Puedes revisarla antes de
          publicar.
        </p>
      ) : null}

      {uploading ? <p className="hint">Guardando el audio…</p> : null}
      {liveTranscript && recording ? (
        <p className="audio-live-transcript" aria-live="polite">
          {liveTranscript}
        </p>
      ) : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}

      {audioUrl ? (
        <div className="audio-transcript">
          <label htmlFor="story-transcript">
            Transcripción <span>(opcional)</span>
          </label>
          <textarea
            id="story-transcript"
            className="field"
            value={transcript}
            maxLength={MAX_TRANSCRIPT}
            placeholder="Escribe o revisa aquí lo que se dice en el audio."
            onChange={(event) => onTranscriptChange(event.target.value)}
            disabled={disabled || recording || uploading}
          />
          <span className="char-count">
            {transcript.length}/{MAX_TRANSCRIPT}
          </span>
          <p className="hint">
            Ayuda a que el audio sea accesible sin tener que escucharlo. Puedes dejarla vacía.
          </p>
        </div>
      ) : null}
    </div>
  );
}
