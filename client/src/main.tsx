import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import {
  bootstrapStoredAppSettings,
  resetTransientSessionOnLaunch,
} from "./lib/supabase";

async function bootstrap() {
  await bootstrapStoredAppSettings();
  resetTransientSessionOnLaunch();

  createRoot(document.getElementById("root")!).render(
    <App />
  );
}

void bootstrap();
