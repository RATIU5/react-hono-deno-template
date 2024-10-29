import { hydrateRoot } from "react-dom/client";
import { App } from "./components/App.tsx";

hydrateRoot(document.getElementById("app")!, <App />);
