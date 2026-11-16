import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { RemoteGate } from "./RemoteGate";
import "./styles.css";

const container = document.getElementById("root");
if (container === null) {
  throw new Error("Missing #root element");
}

createRoot(container).render(
  <StrictMode>
    {/* The gate mounts the store, in local or remote mode — batch 6.2. */}
    <RemoteGate>
      <App />
    </RemoteGate>
  </StrictMode>,
);
