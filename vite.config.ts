import { URL, fileURLToPath } from "node:url"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import { nitro } from "nitro/vite"
import { defineConfig } from "vite"
import pkg from "./package.json" with { type: "json" }
import react from "@vitejs/plugin-react"
import { attachSignalingRoutes } from "./src/server/siginalling/server.ts"
import { printWelcome } from "./src/utils/welcome.ts"
import fs from "node:fs"
import path from "node:path"

function getViteServerConfig() {
	try {
		const configPath = path.resolve(
			import.meta.dirname,
			"src/server-config.json",
		)
		if (fs.existsSync(configPath)) {
			return JSON.parse(fs.readFileSync(configPath, "utf-8"))
		}
	} catch {}
	return { host: "0.0.0.0", frontendPort: 3000 }
}
const serverConfig = getViteServerConfig()

// biome-ignore lint/suspicious/noExplicitAny: Vite server instance
const wireServer = (server: any) => {
	attachSignalingRoutes(server)
	server.httpServer?.once("listening", () => {
		const addr = server.httpServer?.address()
		const port =
			addr && typeof addr === "object" ? addr.port : serverConfig.frontendPort
		printWelcome(port)
	})
}

const config = defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		__FRONTEND_PORT__: JSON.stringify(serverConfig.frontendPort),
	},
	base: "/",
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	plugins: [
		{
			name: "rein-server",
			configureServer: wireServer,
			configurePreviewServer: wireServer,
		},
		devtools(),
		nitro({
			plugins: ["./src/server/nitro-plugin"],
			rollupConfig: {
				external: ["koffi", "x11"],
			},
		}),
		tanstackStart(),
		react({
			babel: {
				plugins: [["babel-plugin-react-compiler", {}]],
			},
		}),
	],
	ssr: {
		noExternal: ["tailwindcss", "@tailwindcss/postcss"],
	},
	server: {
		host: serverConfig.host === "0.0.0.0" ? true : serverConfig.host,
		port: serverConfig.frontendPort,
		watch: {
			ignored: ["**/server-config.json", "**/src/server-config.json"],
		},
	},
	build: {
		rollupOptions: {},
	},
})

export default config
