/** @type {import('next').NextConfig} */
const nextConfig = {
  // En la VM cada build va a su propia carpeta y el servidor lee un enlace
  // (.next-live) que se cambia al terminar: así un despliegue no borra los
  // archivos que está sirviendo. En local y en Vercel sigue siendo .next.
  distDir: process.env.NEXT_DIST_DIR || '.next',
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
