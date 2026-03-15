'use client'

import { Loader2, Coffee, LogOut, Play, RotateCcw } from 'lucide-react'

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

    // Универсальный обработчик для большой кнопки
    const handleMainAction = () => {
        if (isChecking) return;

        if (isOnBreak) {
            // Если на перерыве — возвращаемся
            onBreakMatch(false);
        } else {
            // Иначе — обычный вход/выход
            onAttendanceMatch();
        }
    };

    // Определяем стиль и контент на основе состояния
    const getStatusConfig = () => {
        if (isOnBreak) return {
            label: 'Вернуться',
            sub: 'с перерыва',
            gradient: 'from-orange-500 via-orange-600 to-orange-700 shadow-orange-200',
            icon: <RotateCcw className="w-8 h-8 mb-1" />
        };
        if (isOnSite) return {
            label: 'Уйти',
            sub: 'закончить смену',
            gradient: 'from-rose-500 via-red-500 to-red-600 shadow-red-200',
            icon: <LogOut className="w-8 h-8 mb-1" />
        };
        return {
            label: 'Пришел',
            sub: 'начать смену',
            gradient: 'from-emerald-500 via-green-500 to-emerald-600 shadow-green-200',
            icon: <Play className="w-8 h-8 mb-1 fill-white" />
        };
    };

    const config = getStatusConfig();

    return (
        <div className="w-full flex flex-col items-center space-y-10 pb-6">
            {/* ГЛАВНАЯ КНОПКА КОНТРОЛЯ */}
            <div className="relative group pt-10">
                <button
                    onClick={handleMainAction}
                    disabled={isChecking}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                    className={`relative w-[240px] h-[240px] rounded-full text-white shadow-[0_20px_50px_rgba(0,0,0,0.1)] transition-all duration-150 transform 
                        ${!isChecking ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'opacity-80'} 
                        flex flex-col items-center justify-center outline-none select-none overflow-hidden
                        bg-gradient-to-tr ${config.gradient}`}
                >
                    {/* Анимированный блик на фоне */}
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 translate-x-[-100%] group-hover:translate-x-[100%] skew-x-[-20deg] pointer-events-none"></div>

                    <div className="relative z-20 flex flex-col items-center drop-shadow-lg">
                        {isChecking ? (
                            <Loader2 className="w-14 h-14 animate-spin" />
                        ) : (
                            <>
                                {config.icon}
                                <span className="text-3xl font-black uppercase tracking-tighter leading-none">
                                    {config.label}
                                </span>
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-80 mt-1">
                                    {config.sub}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Внутреннее декоративное кольцо */}
                    <div className="absolute inset-4 rounded-full border border-white/10 pointer-events-none"></div>
                </button>
            </div>

            {/* ВСПОМОГАТЕЛЬНАЯ КНОПКА ПЕРЕРЫВА */}
            {/* Показывается только если человек на смене и НЕ на перерыве */}
            <div className="h-14 flex items-center justify-center">
                {isOnSite && !isOnBreak && (
                    <button
                        onClick={() => onBreakMatch(true)}
                        disabled={isChecking}
                        className="group flex items-center gap-3 px-10 py-4 rounded-3xl bg-white border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest transition-all shadow-sm hover:shadow-md hover:border-orange-200 hover:text-orange-600 active:scale-95 disabled:opacity-50"
                    >
                        <Coffee className="w-4 h-4 transition-transform group-hover:rotate-12" />
                        На перерыв
                    </button>
                )}
            </div>

            {/* ИСТОРИЯ */}
            <button
                onClick={onOpenHistory}
                className="text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] hover:text-indigo-600 transition-colors py-2 px-6 border-b border-transparent hover:border-indigo-100"
            >
                История транзакций
            </button>
        </div>
    )
}