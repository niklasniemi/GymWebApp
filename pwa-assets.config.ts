import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config';

// Regenerate icons from the source logo with `npm run generate-pwa-assets`.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background: '#0d0d0d' } },
    apple: { ...preset.apple, resizeOptions: { background: '#0d0d0d' } },
  },
  images: ['public/favicon.svg'],
});
