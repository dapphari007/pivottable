import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/index.css'; 
import App from './App';
import reportWebVitals from './components/reportWebVitals';
import 'tailwindcss/tailwind.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals(console.log);
