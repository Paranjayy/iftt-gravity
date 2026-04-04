/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disabling turbo to avoid the PostCSS loader panics in this alpha environment
  process: {
    turbo: false
  }
};

module.exports = nextConfig;
