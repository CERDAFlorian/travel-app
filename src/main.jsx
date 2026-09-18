import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './theme/index.scss';
import { applyTheme, APP_THEME } from './theme/themes.js';
import App from './App.jsx';

// L'app démarre sur sa propre charte. Chaque page pose ensuite la sienne via
// useTheme() : le thème du pays à l'intérieur d'un voyage, APP_THEME ailleurs.
applyTheme(APP_THEME);

// BrowserRouter et non HashRouter : les URL restent propres (/voyage/japon-2026
// plutôt que /#/voyage/japon-2026) parce que nginx.conf renvoie déjà index.html
// sur toutes les routes. Sans ce fallback côté serveur, un lien direct
// retournerait un 404.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
