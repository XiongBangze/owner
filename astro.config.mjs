// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://deepx.qzz.io',
  integrations: [mdx()],
  vite: {
    plugins: [tailwindcss()],
  },
});
