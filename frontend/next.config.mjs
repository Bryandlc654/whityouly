/** @type {import('next').NextConfig} */
const nextConfig = {
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
