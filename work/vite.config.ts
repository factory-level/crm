import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";
import { MOCK_INFEROPS } from "./mock/mock-config";
import { WORK } from "./src/work-config";

const mockInferops = `http://${MOCK_INFEROPS.server.host}:${MOCK_INFEROPS.server.port}`;

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	server: {
		host: WORK.server.host,
		port: WORK.server.port,
		strictPort: true,
		proxy: { [WORK.inferops.path]: mockInferops },
	},
});
