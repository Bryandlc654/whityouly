import Image from 'next/image';

interface AvatarProps {
  initials: string;
  avatarUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  alt?: string;
}

const PX: Record<NonNullable<AvatarProps['size']>, number> = { sm: 42, md: 50, lg: 76 };

export default function Avatar({ initials, avatarUrl, size = 'md', alt }: AvatarProps) {
  const cls = size === 'sm' ? 'avatar-sm' : size === 'lg' ? 'avatar-lg' : 'avatar-md';

  return (
    <span className={`avatar ${cls}`}>
      {avatarUrl ? (
        <Image
          src={avatarUrl}
          alt={alt ?? ''}
          width={PX[size]}
          height={PX[size]}
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
