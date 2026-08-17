import koffi from "koffi"
import {
	postKeyEvent,
	postMediaKeyEvent,
	NX_KEYTYPE_PLAY,
	NX_KEYTYPE_NEXT,
	NX_KEYTYPE_PREVIOUS,
} from "./structs.ts"
import { MAC_KEY_MAP } from "../keyMap.ts"
import { resolveChar } from "../utils.ts"

// Media transport keys that require NX_SYSDEFINED events
const MEDIA_KEY_MAP: Record<string, number> = {
	audioplay: NX_KEYTYPE_PLAY,
	audiopause: NX_KEYTYPE_PLAY,
	audionext: NX_KEYTYPE_NEXT,
	audioprev: NX_KEYTYPE_PREVIOUS,
	audiostop: NX_KEYTYPE_PLAY,
}

const MODIFIER_FLAGS: Record<string, number> = {
	meta: 0x00100000,
	command: 0x00100000,
	cmd: 0x00100000,
	shift: 0x00020000,
	control: 0x00040000,
	ctrl: 0x00040000,
	alt: 0x00080000,
	option: 0x00080000,
}

export class MacKeyboard {
	injectKey(key: string, pos: string): void {
		const lowerKey = key.toLowerCase()

		// Media transport keys need NX_SYSDEFINED events, not keyboard keycodes
		const mediaType = MEDIA_KEY_MAP[lowerKey]
		if (mediaType !== undefined) {
			postMediaKeyEvent(mediaType)
			return
		}

		const code = MAC_KEY_MAP[lowerKey]
		if (code !== undefined) {
			if (pos !== "RELEASE") postKeyEvent(code, true)
			if (pos !== "HOLD") postKeyEvent(code, false)
		} else if (key.length > 0) {
			this.injectText(key)
		} else {
			console.warn("[MacKeyboard] Unknown key:", key)
		}
	}

	injectCombo(keys: string[]): void {
		const codes: number[] = []
		let flags = 0
		for (const k of keys) {
			const lower = k.toLowerCase()
			const modFlag = MODIFIER_FLAGS[lower]
			if (modFlag !== undefined) {
				flags |= modFlag
			}
			const code = MAC_KEY_MAP[lower]
			if (code !== undefined) {
				codes.push(code)
			} else {
				console.warn("[MacKeyboard] Unknown combo key:", k)
			}
		}
		if (codes.length === 0) return

		// Press all keys down with modifier flags
		for (const code of codes) {
			postKeyEvent(code, true, flags)
		}
		// Release in reverse order
		for (let i = codes.length - 1; i >= 0; i--) {
			postKeyEvent(codes[i], false, flags)
		}
	}

	injectText(text: string): void {
		if (!text) return
		for (const ch of text) {
			const { code, shifted } = resolveChar(ch, MAC_KEY_MAP)
			if (code === undefined || shifted) {
				// Fall back to Unicode injection for unmapped or shifted characters.
				this.injectUnicodeChar(ch)
				continue
			}
			postKeyEvent(code, true)
			postKeyEvent(code, false)
		}
	}
	private injectUnicodeChar(ch: string): void {
		injectUnicode(ch)
	}
}

// Unicode injection
let _unicodeInjectorLoaded = false
let _CGEventCreateKeyboardEvent:
	| ((s: null, k: number, d: number) => unknown)
	| null = null
let _CGEventKeyboardSetUnicodeString:
	| ((e: unknown, l: number, s: Buffer) => void)
	| null = null
let _CGEventPost: ((tap: number, e: unknown) => void) | null = null
let _CFRelease: ((r: unknown) => void) | null = null

function ensureUnicode() {
	if (_unicodeInjectorLoaded) return
	_unicodeInjectorLoaded = true
	try {
		const lib = koffi.load(
			"/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics",
		)
		_CGEventCreateKeyboardEvent = lib.func(
			"void * CGEventCreateKeyboardEvent(void *, uint16, uint8)",
		)
		_CGEventKeyboardSetUnicodeString = lib.func(
			"void CGEventKeyboardSetUnicodeString(void *, size_t, void *)",
		)
		_CGEventPost = lib.func("void CGEventPost(uint32, void *)")
		_CFRelease = lib.func("void CFRelease(void *)")
	} catch (e) {
		console.warn(
			"[MacKeyboard] Failed to load CoreGraphics for Unicode injection:",
			e,
		)
	}
}

function injectUnicode(ch: string): void {
	ensureUnicode()
	if (
		!_CGEventCreateKeyboardEvent ||
		!_CGEventKeyboardSetUnicodeString ||
		!_CGEventPost ||
		!_CFRelease
	)
		return
	const buf = Buffer.from(ch, "utf16le")
	const charCount = buf.length / 2

	const downRef = _CGEventCreateKeyboardEvent(null, 0, 1)
	if (!downRef) return
	_CGEventKeyboardSetUnicodeString(downRef, charCount, buf)
	_CGEventPost(0, downRef)
	_CFRelease(downRef)

	const upRef = _CGEventCreateKeyboardEvent(null, 0, 0)
	if (!upRef) return
	_CGEventPost(0, upRef)
	_CFRelease(upRef)
}
