import React from "react";
import ReactDOM from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import "@fontsource/archivo/latin-700.css";
import "@fontsource/archivo/latin-900.css";
import "@fontsource/archivo/latin-400.css";
import "@fontsource/archivo/latin-600.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "./styles/app.css";
import App from "./App";
import "./styles/fieldbook.css";
import "./styles/controls.css";
import "./styles/glass.css";
import "./styles/home.css";

class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="app-container">
        <div className="card-soft">
          <h1>No pudimos abrir esta vista</h1>
          <p>Tus datos guardados se conservan. Vuelve a abrir la aplicación.</p>
          <button className="btn-main" onClick={() => window.location.reload()}>
            Volver a abrir
          </button>
        </div>
      </main>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
if (
  !Capacitor.isNativePlatform() &&
  "serviceWorker" in navigator &&
  import.meta.env.PROD
) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
