import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Client as Styletron } from 'styletron-engine-atomic';
import { Provider as StyletronProvider } from 'styletron-react';
import { LightTheme, BaseProvider } from 'baseui';
import './index.css'
import App from './App.tsx'

const engine = new Styletron();

// Force simple render to test if React is working at all
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(
  <StrictMode>
      <StyletronProvider value={engine}>
        <BaseProvider theme={LightTheme}>
    <App />
        </BaseProvider>
      </StyletronProvider>
    </StrictMode>
  );
}
