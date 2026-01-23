import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom'; // ← ADICIONE ESTA LINHA
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter> {/* ← ENVOLVA O <App /> */}
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

reportWebVitals();