import Image from 'next/image';

interface AvatarProps {
  initials: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  alt?: string;
}

export default function Avatar({ initials, avatarUrl, size = 'md', alt }: AvatarProps) {
  const cls = size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : 'avatar-md';

  return (
    <span className={avatarUrl ? `avatar avatar-art avatar-illustrated ${cls}` : `avatar ${cls}`}>
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={alt ?? ''}
          width={96}
          height={96}
          draggable={false}
          // El host cambia entre desarrollo y producción y el backend ya
          // entrega un WebP recortado, así que no pasa por el optimizador.
          unoptimized
        />
      ) : (
        initials
      )}
    </span>
  );
}
