import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/dm-sans';
// The illustrated map's place names (Phase 10.5).
import '@fontsource/fraunces/latin-600-italic.css';
// The TrailMate item cards' text (31-trailmate-item-cards.md, section 1).
import '@fontsource/pixelify-sans/latin-400.css';
import './styles/tokens.css';
import './styles/global.css';
import { App } from './App';
import { startAudio } from './audio/start';

startAudio();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
