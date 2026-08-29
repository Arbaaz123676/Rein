import os from "node:os"
import { execFile, spawn } from "node:child_process"
import logger from "../utils/logger.ts"

/**
 * Reads plain text from the host OS system clipboard.
 */
export async function getSystemClipboard(): Promise<string> {
	const platform = os.platform()
	try {
		if (platform === "darwin") {
			return await readMacClipboard()
		}
		if (platform === "win32") {
			return await readWindowsClipboard()
		}
		if (platform === "linux") {
			return await readLinuxClipboard()
		}
		throw new Error(`Unsupported platform: ${platform}`)
	} catch (err) {
		logger.warn(
			`Failed to read system clipboard on ${platform}: ${String(err)}`,
		)
		throw err
	}
}

/**
 * Writes plain text to the host OS system clipboard.
 */
export async function setSystemClipboard(text: string): Promise<void> {
	const platform = os.platform()
	try {
		if (platform === "darwin") {
			await writeMacClipboard(text)
			return
		}
		if (platform === "win32") {
			await writeWindowsClipboard(text)
			return
		}
		if (platform === "linux") {
			await writeLinuxClipboard(text)
			return
		}
		throw new Error(`Unsupported platform: ${platform}`)
	} catch (err) {
		logger.warn(
			`Failed to write system clipboard on ${platform}: ${String(err)}`,
		)
		throw err
	}
}

// ── macOS Implementation ──
function readMacClipboard(): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"/usr/bin/pbpaste",
			[],
			{ encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
			(err, stdout) => {
				if (err) {
					execFile(
						"pbpaste",
						[],
						{ encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
						(err2, stdout2) => {
							if (err2) return reject(err2)
							resolve(stdout2)
						},
					)
					return
				}
				resolve(stdout)
			},
		)
	})
}

function writeMacClipboard(text: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const proc = spawn("/usr/bin/pbcopy", [], {
			stdio: ["pipe", "ignore", "ignore"],
		})
		proc.on("error", () => {
			const fallback = spawn("pbcopy", [], {
				stdio: ["pipe", "ignore", "ignore"],
			})
			fallback.on("error", reject)
			fallback.on("close", (code) => {
				if (code === 0) resolve()
				else reject(new Error(`pbcopy exited with code ${code}`))
			})
			fallback.stdin.end(text, "utf8")
		})
		proc.on("close", (code) => {
			if (code === 0) resolve()
			else reject(new Error(`pbcopy exited with code ${code}`))
		})
		proc.stdin.end(text, "utf8")
	})
}

// ── Windows Implementation ──
function readWindowsClipboard(): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"powershell.exe",
			[
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Get-Clipboard",
			],
			{ encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
			(err, stdout) => {
				if (err) return reject(err)
				resolve(stdout.replace(/\r\n$/, "").replace(/\n$/, ""))
			},
		)
	})
}

function writeWindowsClipboard(text: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const proc = spawn(
			"powershell.exe",
			[
				"-NoProfile",
				"-NonInteractive",
				"-Command",
				"$val = [Console]::In.ReadToEnd(); Set-Clipboard -Value $val",
			],
			{ stdio: ["pipe", "ignore", "ignore"] },
		)
		proc.on("error", reject)
		proc.on("close", (code) => {
			if (code === 0) resolve()
			else
				reject(new Error(`powershell Set-Clipboard exited with code ${code}`))
		})
		proc.stdin.end(text, "utf8")
	})
}

// ── Linux Implementation ──
function readLinuxClipboard(): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(
			"wl-paste",
			["--no-newline"],
			{ encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
			(wlErr, wlOut) => {
				if (!wlErr) return resolve(wlOut)
				execFile(
					"xclip",
					["-selection", "clipboard", "-o"],
					{ encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
					(xcErr, xcOut) => {
						if (!xcErr) return resolve(xcOut)
						execFile(
							"xsel",
							["--clipboard", "--output"],
							{ encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
							(xsErr, xsOut) => {
								if (!xsErr) return resolve(xsOut)
								reject(
									new Error(
										"No Linux clipboard tool available (wl-paste, xclip, xsel)",
									),
								)
							},
						)
					},
				)
			},
		)
	})
}

function writeLinuxClipboard(text: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const tryWl = () => {
			const proc = spawn("wl-copy", [], {
				stdio: ["pipe", "ignore", "ignore"],
			})
			proc.on("error", () => tryXclip())
			proc.on("close", (code) => {
				if (code === 0) resolve()
				else tryXclip()
			})
			proc.stdin.end(text, "utf8")
		}

		const tryXclip = () => {
			const proc = spawn("xclip", ["-selection", "clipboard"], {
				stdio: ["pipe", "ignore", "ignore"],
			})
			proc.on("error", () => tryXsel())
			proc.on("close", (code) => {
				if (code === 0) resolve()
				else tryXsel()
			})
			proc.stdin.end(text, "utf8")
		}

		const tryXsel = () => {
			const proc = spawn("xsel", ["--clipboard", "--input"], {
				stdio: ["pipe", "ignore", "ignore"],
			})
			proc.on("error", reject)
			proc.on("close", (code) => {
				if (code === 0) resolve()
				else reject(new Error(`xsel exited with code ${code}`))
			})
			proc.stdin.end(text, "utf8")
		}

		tryWl()
	})
}
