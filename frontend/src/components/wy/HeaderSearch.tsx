'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from './Icon';
import Avatar from './Avatar';
import { listPublicStories, type FollowingStory } from '@/lib/stories';
import { searchCharacters, type CharacterSearchItem } from '@/lib/characters';

interface Props {
  onOpenStory: (storyId: string, title: string) => void;
}

const MIN_TERM = 2;
const MAX_PEOPLE = 4;
const MAX_STORIES = 5;

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

/**
 * Buscador del encabezado: se escribe directamente aquí y muestra sugerencias
 * de personajes y relatos sin abrir ningún modal. Enter (o "Ver todos los
 * resultados") lleva a Explorar con la consulta.
 */
export default function HeaderSearch({ onOpenStory }: Props) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState<CharacterSearchItem[]>([]);
  const [stories, setStories] = useState<FollowingStory[]>([]);

  const term = q.trim();

  useEffect(() => {
    if (term.length < MIN_TERM) {
      setPeople([]);
      setStories([]);
      setBusy(false);
      return;
    }

    let active = true;
    setBusy(true);
    const timer = setTimeout(async () => {
      const [charResult, storyResult] = await Promise.all([
        searchCharacters(term, MAX_PEOPLE),
        listPublicStories({ q: term }),
      ]);
      if (!active) return;
      setBusy(false);
      setPeople(charResult.status === 'ok' ? charResult.data.items.slice(0, MAX_PEOPLE) : []);
      setStories(storyResult.status === 'ok' ? storyResult.data.items.slice(0, MAX_STORIES) : []);
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const closeAndBlur = () => {
    setOpen(false);
    inputRef.current?.blur();
  };

  const searchAll = useCallback(() => {
    const value = q.trim();
    closeAndBlur();
    router.push(value ? `/explorar?q=${encodeURIComponent(value)}` : '/explorar');
  }, [router, q]);

  const goToCharacter = (name: string) => {
    setQ('');
    closeAndBlur();
    router.push(`/personaje/${encodeURIComponent(name)}`);
  };

  const openStory = (story: FollowingStory) => {
    closeAndBlur();
    onOpenStory(story.id, story.title);
  };

  const showPanel = open && term.length >= MIN_TERM;
  const hasResults = people.length > 0 || stories.length > 0;

  return (
    <div className="header-search" ref={containerRef}>
      <div className="header-search-box">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          placeholder="Buscar relatos, emociones o seudónimos"
          aria-label="Buscar"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls="header-search-suggestions"
          onChange={(event) => {
            setQ(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              searchAll();
            } else if (event.key === 'Escape') {
              closeAndBlur();
            }
          }}
        />
        {q ? (
          <button
            className="header-search-clear"
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
          >
            <Icon name="x" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div className="header-search-panel" role="listbox" id="header-search-suggestions" aria-label="Sugerencias">
          {busy && !hasResults ? <p className="header-search-status">Buscando…</p> : null}

          {!busy && !hasResults ? (
            <p className="header-search-status">Sin coincidencias para «{term}».</p>
          ) : null}

          {people.length > 0 ? (
            <div className="header-search-group">
              <p className="header-search-group-title">👤 Personajes</p>
              {people.map((person) => (
                <button
                  key={person.name}
                  type="button"
                  className="header-search-item"
                  onClick={() => goToCharacter(person.name)}
                >
                  <Avatar initials={initialsOf(person.name)} avatarUrl={person.avatarUrl} size="sm" />
                  <span className="header-search-item-main">
                    <b>{person.name}</b>
                    {person.tagline ? <small>{person.tagline}</small> : null}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {stories.length > 0 ? (
            <div className="header-search-group">
              <p className="header-search-group-title">📖 Relatos</p>
              {stories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  className="header-search-item"
                  onClick={() => openStory(story)}
                >
                  <span className="header-search-item-ico" aria-hidden>
                    📖
                  </span>
                  <span className="header-search-item-main">
                    <b>{story.title}</b>
                    <small>
                      {story.author.name}
                      {story.categories[0] ? ` · ${story.categories[0]}` : ''}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          <button type="button" className="header-search-all" onClick={searchAll}>
            <Icon name="search" /> Ver todos los resultados
          </button>
        </div>
      ) : null}
    </div>
  );
}
