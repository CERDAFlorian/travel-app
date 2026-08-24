import React from 'react';
import { createRoot } from 'react-dom/client';
import './theme/index.scss';
import { applyTheme, DEFAULT_THEME } from './theme/themes.js';
import App from './App.jsx';

// Provisoire : le thème viendra de trips.theme une fois la donnée branchée (L2).
applyTheme(DEFAULT_THEME);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
