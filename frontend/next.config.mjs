/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow building inside Docker without telemetry prompts.
  output: "standalone",
};

export default nextConfig;
