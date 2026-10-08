import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { OrchestrationLab } from "@/components/orchestra-lab/OrchestrationLab";
import "@/app/globals.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("找不到浏览器应用挂载节点");
}

createRoot(root).render(
  <StrictMode>
    <OrchestrationLab />
  </StrictMode>,
);
