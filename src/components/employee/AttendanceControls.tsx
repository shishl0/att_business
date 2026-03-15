import { Loader2 } from 'lucide-react'

type AttendanceControlsProps = {
    isOnSite: boolean
    isOnBreak: boolean
    lastAction: string | null
    isChecking: boolean
    onAttendanceMatch: () => Promise<void>
    onBreakMatch: (startBreak: boolean) => Promise<void>
    onOpenHistory: () => void
}

export default function AttendanceControls({
    isOnSite,
    isOnBreak,
    lastAction,
    isChecking,
    onAttendanceMatch,
    onBreakMatch,
    onOpenHistory
}: AttendanceControlsProps) {

    // Определяем цвет главной кнопки на основе состояния
    const getButtonGradient = () => {
        if (isOnBreak) return 'from-orange-500 via-orange-600 to-orange-700' // Внимание на перерыв
        if (isOnSite) return 'from-rose-500 via-red-500 to-red-600'          // На выход
        return 'from-emerald-500 via-green-500 to-emerald-600'              // На вход
    }

    return (
        <div className="w-full flex flex-col items-center space-y-8 pb-4"> {/* Исправлено: space-y-8 */}
            <button
                onClick={onAttendanceMatch}
                disabled={isChecking}
                aria-label={isOnSite ? 'Отметить уход' : 'Отметить приход'}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className={`group relative w-[200px] h-[200px] rounded-full text-3xl font-black text-white shadow-2xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center outline-none select-none overflow-hidden mt-8 mb-4
                  ${isChecking ? 'opacity-80 scale-[0.97]' : ''}`}
            >
                {/* Динамический фон */}
                <div className={`absolute inset-0 bg-gradient-to-tr transition-colors duration-500 ease-in-out ${getButtonGradient()}`}></div>

                {/* Внутреннее кольцо */}
                <div className="absolute inset-2 rounded-full border-4 border-white/20 transition-transform group-hover:scale-105 group-active:scale-95 duration-300 z-10 pointer-events-none"></div>

                {/* Контент кнопки */}
                <span className="relative z-20 flex items-center justify-center drop-shadow-md text-center max-w-[150px] leading-tight uppercase">
                    {isChecking ? (
                        <Loader2 className="w-12 h-12 animate-spin text-white" />
                    ) : (
                        isOnSite ? 'Уйти' : (isOnBreak ? 'Вернуться' : 'Войти')
                    )}
                </span>
            </button>

            {/* Кнопка перерыва */}
            {(isOnSite || isOnBreak) && (
                <button
                    onClick={() => onBreakMatch(!isOnBreak)}
                    disabled={isChecking}
                    className={`px-8 py-3 rounded-full font-bold text-sm uppercase tracking-wide transition-all shadow-md active:scale-95 ${isOnBreak
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-orange-500 text-white hover:bg-orange-600'
                        } disabled:opacity-50`}
                >
                    {isOnBreak ? 'Завершить перерыв' : 'На перерыв'}
                </button>
            )}

            <button
                onClick={onOpenHistory}
                className="mt-4 text-blue-600 font-bold text-sm underline underline-offset-4 decoration-blue-200 hover:text-blue-700 transition duration-200"
            >
                История транзакций
            </button>
        </div>
    )
}