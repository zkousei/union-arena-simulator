import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { CardDataBootstrap } from './components/CardDataBootstrap';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <CardDataBootstrap />
    </BrowserRouter>
  </React.StrictMode>
);
