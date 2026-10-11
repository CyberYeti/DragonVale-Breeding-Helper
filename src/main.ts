import { mount } from 'svelte';
import './ui/theme.css';
import App from './ui/App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

// Dev-only component gallery at ?gallery; the branch is dropped from production builds.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('gallery')) {
  void import('./ui/dev/TileGallery.svelte').then(({ default: TileGallery }) => mount(TileGallery, { target }));
} else {
  mount(App, { target });
}
