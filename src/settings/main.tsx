import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { HashRouter } from "react-router";
import { StateProvider } from "@renderer/hooks/useNewState";
import i18n from "@renderer/i18n";

import { I18nextProvider } from "react-i18next";

import "../global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <HashRouter>
      <I18nextProvider i18n={i18n} defaultNS="settings">
        <StateProvider>
          <App />
        </StateProvider>
      </I18nextProvider>
    </HashRouter>
  </React.StrictMode>,
);
