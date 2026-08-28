import { CheckCircle2 } from "lucide-react"
import type { FC } from "react"

export interface ThemeEntry {
	value: string
	label: string
	isDark: boolean
}

// All supported themes. Add new custom themes here — the preview renders
// automatically by applying data-theme to each card div.
export const THEME_LIST: ThemeEntry[] = [
	{ value: "dracula", label: "Dracula", isDark: true },
	{ value: "night", label: "Night", isDark: true },
	{ value: "sunset", label: "Sunset", isDark: true },
	{ value: "forest", label: "Forest", isDark: true },
	{ value: "cupcake", label: "Cupcake", isDark: false },
	{ value: "nord", label: "Nord", isDark: false },
	{ value: "lofi", label: "Lo-Fi", isDark: false },
	{ value: "lemonade", label: "Lemonade", isDark: false },
]

interface ThemePickerProps {
	value: string
	onChange: (theme: string) => void
}

const ThemePicker: FC<ThemePickerProps> = ({ value, onChange }) => {
	return (
		<div className="grid grid-cols-4 gap-3">
			{THEME_LIST.map((entry) => {
				const isSelected = value === entry.value
				return (
					<button
						type="button"
						key={entry.value}
						data-theme={entry.value}
						onClick={() => onChange(entry.value)}
						title={entry.label}
						aria-label={`Select ${entry.label} theme`}
						aria-pressed={isSelected}
						className={[
							"relative flex flex-col gap-1 p-2 rounded-xl cursor-pointer border-2 transition-all duration-150",
							"bg-base-100 w-24 items-center hover:scale-105 active:scale-95",
							isSelected
								? "border-primary ring-2 ring-primary ring-offset-2 ring-offset-base-100"
								: "border-base-300 hover:border-primary/60",
						].join(" ")}
					>
						{/* Color swatch row showing primary/secondary/accent/neutral */}
						<div className="flex w-full gap-0.5 rounded-md overflow-hidden h-5">
							<div className="flex-1 bg-primary" />
							<div className="flex-1 bg-secondary" />
							<div className="flex-1 bg-accent" />
							<div className="flex-1 bg-neutral" />
						</div>
						{/* Theme name */}
						<span className="text-xs font-medium text-base-content mt-0.5 truncate w-full text-center">
							{entry.label}
						</span>
						{isSelected && (
							<div className="absolute top-1 right-1 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center">
								<CheckCircle2 />
							</div>
						)}
					</button>
				)
			})}
		</div>
	)
}

export default ThemePicker
