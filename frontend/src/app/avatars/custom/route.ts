import {
  parseAvatarConfigFromUrl,
  renderAvatarSvg,
  DEFAULT_AVATAR_CONFIG,
} from '@/lib/avatar-creator';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  const url = new URL(request.url);
  const config =
    parseAvatarConfigFromUrl(`${url.pathname}${url.search}`) ?? DEFAULT_AVATAR_CONFIG;

  return new Response(renderAvatarSvg(config), {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
