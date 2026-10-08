'use client';

import { useRef, useState } from 'react';
import Icon from './Icon';
import { uploadAudio, uploadFile } from '@/lib/files';
import {
  addStoryStage,
  deleteStoryStage,
  editStoryStage,
  getMyStory,
  type MyStory,
  type StoryStage,
} from '@/lib/stories';

interface Props {
  story: MyStory;
  onClose: () => void;
  onChanged: () => void;
}

interface PickedMedia {
  id: string;
  url: string;
  name: string;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export default function StoryDetailModal({ story, onClose, onChanged }: Props) {
  const [stages, setStages] = useState<StoryStage[]>(story.updates);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Alta de una nueva etapa.
  const [addText, setAddText] = useState('');
  const [addImage, setAddImage] = useState<PickedMedia | null>(null);
  const [addAudio, setAddAudio] = useState<PickedMedia | null>(null);
  const addImageInput = useRef<HTMLInputElement>(null);
  const addAudioInput = useRef<HTMLInputElement>(null);

  // EdiciÃ³n de una etapa existente. `undefined` = no tocar; `null` = quitar.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editImage, setEditImage] = useState<string | null | undefined>(undefined);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  const [editAudio, setEditAudio] = useState<string | null | undefined>(undefined);
  const [editAudioUrl, setEditAudioUrl] = useState<string | null>(null);
  const editImageInput = useRef<HTMLInputElement>(null);
  const editAudioInput = useRef<HTMLInputElement>(null);

  async function refresh() {
    const result = await getMyStory(story.id);
    if (result.status === 'ok') {
      setStages(result.data.updates);
      onChanged();
    }
  }

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>,
    kind: 'image' | 'audio',
    set: (media: PickedMedia | null) => void,
  ) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError('');
    const result = kind === 'image' ? await uploadFile(file) : await uploadAudio(file);
    setBusy(false);

    if (result.status === 'ok') {
      set({ id: result.data.id, url: result.data.fileUrl, name: result.data.originalName ?? kind });
      return;
    }
    setError(result.message);
  }

  async function submitAdd() {
    if (!addText.trim() && !addImage && !addAudio) return;
    setBusy(true);
    setError('');

    const result = await addStoryStage(story.id, {
      content: addText.trim(),
      mediaAssetId: addImage?.id,
      audioAssetId: addAudio?.id,
    });

    setBusy(false);

    if (result.status === 'ok') {
      setAddText('');
      setAddImage(null);
      setAddAudio(null);
      await refresh();
      return;
    }
    setError(result.message);
  }

  function startEdit(stage: StoryStage) {
    setEditingId(stage.id);
    setEditText(stage.content);
    setEditImage(undefined);
    setEditImageUrl(stage.mediaUrl);
    setEditAudio(undefined);
    setEditAudioUrl(stage.audioUrl);
  }

  async function submitEdit() {
    if (!editingId || (!editText.trim() && !editImageUrl && !editAudioUrl)) return;
    setBusy(true);
    setError('');

    const result = await editStoryStage(story.id, editingId, {
      content: editText.trim(),
      ...(editImage !== undefined ? { mediaAssetId: editImage } : {}),
      ...(editAudio !== undefined ? { audioAssetId: editAudio } : {}),
    });

    setBusy(false);

    if (result.status === 'ok') {
      setEditingId(null);
      await refresh();
      return;
    }
    setError(result.message);
  }

  async function removeStage(updateId: string) {
    setBusy(true);
    setError('');
    const result = await deleteStoryStage(story.id, updateId);
    setBusy(false);

    if (result.status === 'ok') {
      await refresh();
      return;
    }
    setError(result.message);
  }

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Etapas del relato">
      <div className="modal-head">
        <div>
          <h2>{story.title}</h2>
          <p>
            {stages.length} {stages.length === 1 ? 'etapa' : 'etapas'} Â·{' '}
            {story.status === 'PUBLISHED' ? 'Publicado' : 'Borrador'}
          </p>
        </div>
        <button className="close" type="button" onClick={onClose} aria-label="Cerrar">
          <Icon name="x" />
        </button>
      </div>

      {error ? (
        <p className="auth-error" role="alert" style={{ marginTop: 14 }}>
          {error}
        </p>
      ) : null}

      <div className="stage-list" style={{ marginTop: 14 }}>
        {stages.map((stage) => (
          <div key={stage.id} className="stage-item">
            <div className="stage-head">
              <span>Etapa {stage.stageOrder}</span>
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {formatDate(stage.createdAt)}
                <button
                  className="text-link"
                  type="button"
                  onClick={() => startEdit(stage)}
                  disabled={busy}
                >
                  Editar
                </button>
                {stages.length > 1 ? (
                  <button
                    className="link-danger"
                    type="button"
                    onClick={() => void removeStage(stage.id)}
                    disabled={busy}
                  >
                    Eliminar
                  </button>
                ) : null}
              </span>
            </div>

            {editingId === stage.id ? (
              <div className="stack">
                <textarea
                  className="field"
                  value={editText}
                  maxLength={5000}
                  style={{ minHeight: 100 }}
                  onChange={(event) => setEditText(event.target.value)}
                />
                <div className="row-between">
                  <span className="hint" style={{ margin: 0 }}>
                    {editImageUrl ? 'Con imagen' : 'Sin imagen'} Â· {editAudioUrl ? 'con audio' : 'sin audio'}
                  </span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => editImageInput.current?.click()}
                    >
                      <Icon name="sparkle" /> Imagen
                    </button>
                    {editImageUrl ? (
                      <button
                        className="ghost"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditImage(null);
                          setEditImageUrl(null);
                        }}
                      >
                        Quitar imagen
                      </button>
                    ) : null}
                    <button
                      className="secondary"
                      type="button"
                      disabled={busy}
                      onClick={() => editAudioInput.current?.click()}
                    >
                      <Icon name="music" /> Audio
                    </button>
                    {editAudioUrl ? (
                      <button
                        className="ghost"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditAudio(null);
                          setEditAudioUrl(null);
                        }}
                      >
                        Quitar audio
                      </button>
                    ) : null}
                  </div>
                </div>
                {editImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editImageUrl} alt="" style={{ borderRadius: 12, maxWidth: '100%' }} />
                ) : null}
                {editAudioUrl ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio controls src={editAudioUrl} style={{ width: '100%' }} />
                ) : null}
                <div className="modal-actions">
                  <button className="ghost" type="button" onClick={() => setEditingId(null)} disabled={busy}>
                    Cancelar
                  </button>
                  <button
                    className="primary"
                    type="button"
                    style={{ padding: '10px 16px' }}
                    onClick={() => void submitEdit()}
                    disabled={busy || (!editText.trim() && !editImageUrl && !editAudioUrl)}
                  >
                    {busy ? 'Guardandoâ€¦' : 'Guardar etapa'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>{stage.content}</p>
                {stage.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={stage.mediaUrl} alt="" style={{ marginTop: 10, borderRadius: 12, maxWidth: '100%' }} />
                ) : null}
                {stage.audioUrl ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <audio controls src={stage.audioUrl} style={{ width: '100%', marginTop: 10 }} />
                ) : null}
              </>
            )}
          </div>
        ))}
      </div>

      <label className="field-label">AÃ±adir una nueva etapa</label>
      <textarea
        className="field"
        value={addText}
        maxLength={5000}
        style={{ minHeight: 100 }}
        placeholder="Â¿CÃ³mo sigue la historia?"
        onChange={(event) => setAddText(event.target.value)}
      />
      <div className="row-between" style={{ marginTop: 8 }}>
        <span className="hint" style={{ margin: 0 }}>
          {addImage ? 'Imagen lista' : 'Sin imagen'} Â· {addAudio ? 'audio listo' : 'sin audio'}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="secondary" type="button" disabled={busy} onClick={() => addImageInput.current?.click()}>
            <Icon name="sparkle" /> {addImage ? 'Cambiar imagen' : 'Imagen'}
          </button>
          <button className="secondary" type="button" disabled={busy} onClick={() => addAudioInput.current?.click()}>
            <Icon name="music" /> {addAudio ? 'Cambiar audio' : 'Audio'}
          </button>
        </div>
      </div>

      <input
        ref={addImageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => void handleUpload(event, 'image', setAddImage)}
        aria-label="Imagen de la etapa"
      />
      <input
        ref={addAudioInput}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/webm,audio/wav"
        className="hidden"
        onChange={(event) => void handleUpload(event, 'audio', setAddAudio)}
        aria-label="Audio de la etapa"
      />
      <input
        ref={editImageInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setBusy(true);
          const result = await uploadFile(file);
          setBusy(false);
          if (result.status === 'ok') {
            setEditImage(result.data.id);
            setEditImageUrl(result.data.fileUrl);
          } else {
            setError(result.message);
          }
        }}
        aria-label="Cambiar imagen de la etapa"
      />
      <input
        ref={editAudioInput}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/webm,audio/wav"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          setBusy(true);
          const result = await uploadAudio(file);
          setBusy(false);
          if (result.status === 'ok') {
            setEditAudio(result.data.id);
            setEditAudioUrl(result.data.fileUrl);
          } else {
            setError(result.message);
          }
        }}
        aria-label="Cambiar audio de la etapa"
      />

      <div className="modal-actions">
        <button className="ghost" type="button" onClick={onClose}>
          Cerrar
        </button>
        <button
          className="primary"
          type="button"
          style={{ padding: '11px 17px' }}
          onClick={() => void submitAdd()}
          disabled={busy || (!addText.trim() && !addImage && !addAudio)}
        >
          {busy ? 'Guardandoâ€¦' : 'AÃ±adir etapa'}
        </button>
      </div>
    </div>
  );
}
