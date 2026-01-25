
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Bridge Vite's env vars to process.env for SDK compatibility as per instructions
if (typeof window !== 'undefined') {
  (window as any).process = (window as any).process || { env: {} };
  const viteKey = (import.meta as any).env?.VITE_API_KEY;
  if (viteKey) {
    (window as any).process.env.API_KEY = viteKey;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
