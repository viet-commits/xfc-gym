import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Required for canonical URLs, absolute structured-data URLs, and the sitemap.
  site: 'https://xfcgym.com.au',
  output: 'static',
  // The build emits directory-style URLs, so every canonical ends in a slash.
  // Declaring it here keeps internal links, canonicals and the sitemap in agreement
  // instead of relying on a host-level redirect on every click.
  trailingSlash: 'always',
  integrations: [
    tailwind(),
    sitemap({
      filter: (page) => !page.includes('/404'),
      changefreq: 'weekly',
      serialize(item) {
        if (item.url === 'https://xfcgym.com.au/') item.priority = 1.0;
        else if (/\/(join|timetable|classes)\/$/.test(item.url)) item.priority = 0.9;
        else if (/\/coaches\/$/.test(item.url)) item.priority = 0.8;
        else if (/\/facilities\/$/.test(item.url)) item.priority = 0.7;
        else item.priority = 0.5;
        if (/\/timetable\/$/.test(item.url)) item.changefreq = 'daily';
        return item;
      },
    }),
  ],
});
