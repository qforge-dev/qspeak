import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { BrowserRouter } from "react-router";
import "../global.css";
import "./recorder.css";
import i18n from "@renderer/i18n";
import { I18nextProvider } from "react-i18next";
import { StateProvider } from "@renderer/hooks/useNewState";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <I18nextProvider i18n={i18n} defaultNS="recorder">
        <StateProvider>
          <App />
        </StateProvider>
      </I18nextProvider>
    </BrowserRouter>
  </StrictMode>,
);
