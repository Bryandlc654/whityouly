/** @type {import('next').NextConfig} */

// Origen de la API para la CSP. En producción viene de .env.production.local.
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').origin;
  } catch {
    return 'http://localhost:3000';
  }
})();

const isDev = process.env.NODE_ENV === 'development';

// Next inserta scripts y estilos en línea, así que `unsafe-inline` es necesario.
// No se permite `unsafe-eval` fuera de desarrollo. El resto queda restringido a
// la propia web y al origen de la API.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${apiOrigin}`,
  `media-src 'self' blob: ${apiOrigin}`,
  "font-src 'self' data:",
  `connect-src 'self' ${apiOrigin}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: contentSecurityPolicy,
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), payment=(), usb=()',
  },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
];

const nextConfig = {
  // Deja de anunciar la versión del framework.
  poweredByHeader: false,
  // En la VM cada build va a su propia carpeta y el servidor lee un enlace
  // (.next-live) que se cambia al terminar: así un despliegue no borra los
  // archivos que está sirviendo. En local y en Vercel sigue siendo .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        // La sección se llama Feed; /dashboard era el nombre anterior.
        source: '/dashboard/:path*',
        destination: '/feed',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
