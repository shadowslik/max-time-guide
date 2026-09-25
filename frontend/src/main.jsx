import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@maxhub/max-ui/styles.css';
import './styles/tokens.css';
import './styles/app.css';
import './styles/screens.css';
import './styles/motion.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
