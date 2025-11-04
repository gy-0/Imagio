import React from 'react';
import ReactDOM from 'react-dom/client';
import { SessionProvider } from './context/SessionContext';
import { AutomationProvider } from './context/AutomationContext';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <AutomationProvider>
        <App />
      </AutomationProvider>
    </SessionProvider>
  </React.StrictMode>
);
