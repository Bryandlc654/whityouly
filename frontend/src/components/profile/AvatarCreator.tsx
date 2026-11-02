'use client';

import Image from 'next/image';
import Icon from '@/components/wy/Icon';
import {
  AVATAR_ACCESSORIES,
  AVATAR_BACKGROUNDS,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIR_STYLES,
  AVATAR_OUTFIT_COLORS,
  AVATAR_OUTFIT_STYLES,
  AVATAR_SKIN_TONES,
  avatarConfigToUrl,
  type AvatarConfig,
} from '@/lib/avatar-creator';

interface Props {
  config: AvatarConfig;
  busy?: boolean;
  onChange: (config: AvatarConfig) => void;
  onApply: () => void;
  onCancel: () => void;
  onRandomize: () => void;
}

interface OptionGroupProps {
  label: string;
  selected: string;
  children: React.ReactNode;
}

function OptionGroup({ label, selected, children }: OptionGroupProps) {
  return (
    <div className="avatar-creator-group">
      <div className="avatar-creator-label">
        <span>{label}</span>
        <strong>{selected}</strong>
      </div>
      <div className="avatar-creator-options">{children}</div>
    </div>
  );
}

export default function AvatarCreator({
  config,
  busy,
  onChange,
  onApply,
  onCancel,
  onRandomize,
}: Props) {
  const previewUrl = avatarConfigToUrl(config);

  return (
    <div className="avatar-creator" aria-label="Creador de avatar">
      <div className="avatar-creator-preview">
        <Image
          src={previewUrl}
          alt="Vista previa de tu avatar creado"
          width={112}
          height={112}
          unoptimized
        />
        <span className="hint">Así te verán las demás personas.</span>
      </div>

      <div className="avatar-creator-controls">
        <OptionGroup
          label="Tono de piel"
          selected={AVATAR_SKIN_TONES.find((item) => item.id === config.skin)?.label ?? ''}
        >
          {AVATAR_SKIN_TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className={`avatar-swatch${config.skin === tone.id ? ' active' : ''}`}
              style={{ background: tone.color }}
              aria-label={`Tono de piel ${tone.label}`}
              aria-pressed={config.skin === tone.id}
              title={tone.label}
              onClick={() => onChange({ ...config, skin: tone.id })}
              disabled={busy}
            />
          ))}
        </OptionGroup>

        <OptionGroup
          label="Peinado"
          selected={AVATAR_HAIR_STYLES.find((item) => item.id === config.hair)?.label ?? ''}
        >
          {AVATAR_HAIR_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`avatar-creator-option${config.hair === style.id ? ' active' : ''}`}
              aria-pressed={config.hair === style.id}
              onClick={() => onChange({ ...config, hair: style.id })}
              disabled={busy}
            >
              {style.label}
            </button>
          ))}
        </OptionGroup>

        <OptionGroup
          label="Color de pelo"
          selected={
            AVATAR_HAIR_COLORS.find((item) => item.id === config.hairColor)?.label ?? ''
          }
        >
          {AVATAR_HAIR_COLORS.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className={`avatar-swatch${config.hairColor === tone.id ? ' active' : ''}`}
              style={{ background: tone.color }}
              aria-label={`Pelo ${tone.label}`}
              aria-pressed={config.hairColor === tone.id}
              title={tone.label}
              onClick={() => onChange({ ...config, hairColor: tone.id })}
              disabled={busy}
            />
          ))}
        </OptionGroup>

        <OptionGroup
          label="Ropa"
          selected={
            AVATAR_OUTFIT_STYLES.find((item) => item.id === config.outfit)?.label ?? ''
          }
        >
          {AVATAR_OUTFIT_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`avatar-creator-option${config.outfit === style.id ? ' active' : ''}`}
              aria-pressed={config.outfit === style.id}
              onClick={() => onChange({ ...config, outfit: style.id })}
              disabled={busy}
            >
              {style.label}
            </button>
          ))}
        </OptionGroup>

        <OptionGroup
          label="Color de ropa"
          selected={
            AVATAR_OUTFIT_COLORS.find((item) => item.id === config.outfitColor)?.label ?? ''
          }
        >
          {AVATAR_OUTFIT_COLORS.map((tone) => (
            <button
              key={tone.id}
              type="button"
              className={`avatar-swatch${config.outfitColor === tone.id ? ' active' : ''}`}
              style={{ background: tone.color }}
              aria-label={`Ropa ${tone.label}`}
              aria-pressed={config.outfitColor === tone.id}
              title={tone.label}
              onClick={() => onChange({ ...config, outfitColor: tone.id })}
              disabled={busy}
            />
          ))}
        </OptionGroup>

        <OptionGroup
          label="Fondo"
          selected={
            AVATAR_BACKGROUNDS.find((item) => item.id === config.background)?.label ?? ''
          }
        >
          {AVATAR_BACKGROUNDS.map((background) => (
            <button
              key={background.id}
              type="button"
              className={`avatar-swatch${config.background === background.id ? ' active' : ''}`}
              style={{
                background: `linear-gradient(135deg, ${background.from}, ${background.to})`,
              }}
              aria-label={`Fondo ${background.label}`}
              aria-pressed={config.background === background.id}
              title={background.label}
              onClick={() => onChange({ ...config, background: background.id })}
              disabled={busy}
            />
          ))}
        </OptionGroup>

        <OptionGroup
          label="Accesorio"
          selected={
            AVATAR_ACCESSORIES.find((item) => item.id === config.accessory)?.label ?? ''
          }
        >
          {AVATAR_ACCESSORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`avatar-creator-option${config.accessory === item.id ? ' active' : ''}`}
              aria-pressed={config.accessory === item.id}
              onClick={() => onChange({ ...config, accessory: item.id })}
              disabled={busy}
            >
              {item.label}
            </button>
          ))}
        </OptionGroup>

        <div className="avatar-creator-actions">
          <button className="ghost" type="button" onClick={onRandomize} disabled={busy}>
            <Icon name="sparkle" /> Sorpréndeme
          </button>
          <div>
            <button className="ghost" type="button" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
            <button className="primary" type="button" onClick={onApply} disabled={busy}>
              Usar este avatar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
