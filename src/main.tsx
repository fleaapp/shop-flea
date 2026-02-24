import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Detect Android and add class to html for platform-specific CSS
if (/android/i.test(navigator.userAgent)) {
  document.documentElement.classList.add('android');
}

createRoot(document.getElementById("root")!).render(<App />);
