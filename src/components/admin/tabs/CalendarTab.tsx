'use client'

import { useState, useEffect } from 'react'
import {
    ChevronLeft, ChevronRight, ClockAlert,
    Calendar as CalendarIcon, MapPin, User,
    LayoutGrid, ListFilter, Circle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Shift } from '@/types'
import { WEEKDAYS } from '@/lib/constants'
import { getDaysInMonth, getFirstDayOfMonth } from '@/lib/utils/date'

type CalendarTabProps = {
    calendarShifts: Record<string, Shift[]>
}

export default function CalendarTab({ calendarShifts }: CalendarTabProps) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [calendarView, setCalendarView] = useState<'month' | 'week'>('month')
    const today = new Date()

    useEffect(() => {
        const checkMobile = () => {
            setCalendarView(window.innerWidth < 1024 ? 'week' : 'month')
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const isToday = (day: number) => {
        return today.getDate() === day &&
            today.getMonth() === currentDate.getMonth() &&
            today.getFullYear() === currentDate.getFullYear()
    }

    const renderShiftCard = (empName: string, empShifts: Shift[]) => {
        const hasOvertime = empShifts.some(s => s.is_overtime)
        const hasLate = empShifts.some(s => s.is_late)

        return (
            <div key={empName} className={`
                group p-2 rounded-xl border transition-all text-[11px] leading-tight
                ${hasLate ? 'bg-rose-50/50 border-rose-100' : hasOvertime ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100 hover:border-indigo-200'}
            `}>
                <div className="flex items-center justify-between mb-1 gap-1">
                    <span className="font-bold text-slate-700 truncate">{empName}</span>
                    <div className="flex gap-0.5 shrink-0">
                        {hasLate && <Circle className="w-2 h-2 fill-rose-500 text-rose-500" />}
                        {hasOvertime && <ClockAlert className="w-3 h-3 text-amber-600" />}
                    </div>
                </div>

                {empShifts.map((s, i) => {
                    const inT = s.check_in_time ? new Date(s.check_in_time) : null
                    const outT = s.check_out_time ? new Date(s.check_out_time) : null
                    return (
                        <div key={i} className="text-[10px] text-slate-500 font-medium flex justify-between border-t border-slate-200/50 mt-1 pt-1 first:border-0 first:pt-0">
                            <span>{inT?.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) || '--:--'}</span>
                            <span className="mx-1 opacity-40">-</span>
                            <span>{outT?.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) || '...'}</span>
                        </div>
                    )
                })}
            </div>
        )
    }

    const renderCalendarCell = (year: number, month: number, day: number) => {
        if (day === 0) return <div className="hidden lg:block aspect-square opacity-20 bg-slate-100 rounded-3xl border border-dashed border-slate-300"></div>

        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dayShifts = calendarShifts[dStr] || []

        const groupedShifts: Record<string, Shift[]> = {}
        dayShifts.forEach(s => {
            if (!groupedShifts[s.employee_name]) groupedShifts[s.employee_name] = []
            groupedShifts[s.employee_name].push(s)
        })

        return (
            <div className={`
                min-h-[120px] lg:aspect-square flex flex-col bg-white border rounded-3xl p-3 transition-all relative
                ${isToday(day) ? 'ring-2 ring-indigo-500 border-transparent shadow-lg shadow-indigo-100' : 'border-slate-200 shadow-sm hover:shadow-md'}
            `}>
                <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-black ${isToday(day) ? 'text-indigo-600' : 'text-slate-400'}`}>
                        {day}
                    </span>
                    {dayShifts.length > 0 && (
                        <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-lg font-bold">
                            {dayShifts.length}
                        </span>
                    )}
                </div>

                <div className="flex flex-col gap-1.5 overflow-y-auto no-scrollbar max-h-[120px]">
                    {Object.entries(groupedShifts).map(([name, shifts]) => renderShiftCard(name, shifts))}
                    {dayShifts.length === 0 && (
                        <div className="flex-1 flex items-center justify-center opacity-10">
                            <CalendarIcon className="w-6 h-6" />
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const renderControls = () => (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-[2.5rem] border border-slate-200 shadow-sm">
            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <div className="text-center sm:text-left">
                    <h3 className="text-lg font-black text-slate-800 capitalize tracking-tight">
                        {currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
                    </h3>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>
                    <ChevronRight className="w-5 h-5" />
                </Button>
            </div>

            <div className="flex p-1.5 bg-slate-100 rounded-2xl w-full sm:w-auto">
                <button
                    onClick={() => setCalendarView('month')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${calendarView === 'month' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutGrid className="w-4 h-4" /> МЕСЯЦ
                </button>
                <button
                    onClick={() => setCalendarView('week')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-xs font-black transition-all ${calendarView === 'week' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ListFilter className="w-4 h-4" /> НЕДЕЛЯ
                </button>
            </div>
        </div>
    )

    return (
        <div className="space-y-6 pb-10 animate-in fade-in zoom-in-95 duration-200">
            {renderControls()}

            {calendarView === 'month' ? (
                <div className="space-y-4">
                    {/* Weekday labels */}
                    <div className="grid grid-cols-7 gap-3 px-4">
                        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                            <div key={day} className="text-center text-[11px] font-black uppercase tracking-widest text-slate-400">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {(() => {
                            const year = currentDate.getFullYear()
                            const month = currentDate.getMonth()
                            const daysInMonth = getDaysInMonth(year, month)
                            // Коррекция на Пн-Вс (getFirstDay может возвращать 0 для Вс)
                            let firstDay = getFirstDayOfMonth(year, month)
                            firstDay = firstDay === 0 ? 6 : firstDay - 1

                            const calendarDays = Array(firstDay).fill(0).concat(
                                Array.from({ length: daysInMonth }, (_, i) => i + 1)
                            )

                            return calendarDays.map((day, i) => (
                                <div key={i} className={day === 0 ? "hidden lg:block" : ""}>
                                    {renderCalendarCell(year, month, day)}
                                </div>
                            ))
                        })()}
                    </div>
                </div>
            ) : (
                /* Режим "Неделя" — идеален для мобилок */
                <div className="flex flex-col gap-6">
                    {(() => {
                        const days = []
                        // Генерируем текущие 7 дней (или 5)
                        for (let i = -1; i <= 5; i++) {
                            const d = new Date(currentDate)
                            d.setDate(d.getDate() + i)
                            days.push(d)
                        }

                        return days.map((d, i) => {
                            const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                            const shifts = calendarShifts[dStr] || []
                            const dayName = d.toLocaleDateString('ru-RU', { weekday: 'long' })

                            return (
                                <div key={i} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
                                    <div className={`p-5 flex justify-between items-center ${d.getDate() === today.getDate() ? 'bg-indigo-50 border-b border-indigo-100' : 'bg-slate-50 border-b border-slate-100'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center font-black ${d.getDate() === today.getDate() ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>
                                                <span className="text-[10px] uppercase opacity-60 leading-none">{d.toLocaleDateString('ru-RU', { weekday: 'short' })}</span>
                                                <span className="text-lg leading-none">{d.getDate()}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-black capitalize text-slate-800">{dayName}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Смен: {shifts.length}</p>
                                            </div>
                                        </div>
                                        {shifts.length > 0 && <ChevronRight className="w-5 h-5 text-slate-300" />}
                                    </div>

                                    <div className="p-4 space-y-3">
                                        {shifts.length > 0 ? (
                                            Object.entries(
                                                shifts.reduce((acc, s) => {
                                                    if (!acc[s.employee_name]) acc[s.employee_name] = []
                                                    acc[s.employee_name].push(s)
                                                    return acc
                                                }, {} as Record<string, Shift[]>)
                                            ).map(([name, empShifts]) => (
                                                <div key={name} className="flex items-start gap-4 p-4 rounded-3xl bg-slate-50/50 border border-slate-100">
                                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs shrink-0">
                                                        {name.charAt(0)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
                                                            <div className="flex gap-1">
                                                                {empShifts.some(s => s.is_late) && <span className="bg-rose-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase">Опоздал</span>}
                                                            </div>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {empShifts.map((s, idx) => (
                                                                <div key={idx} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-[11px] font-black text-slate-600">
                                                                    <ClockAlert className={`w-3 h-3 ${s.is_overtime ? 'text-amber-500' : 'text-indigo-400'}`} />
                                                                    {s.check_in_time ? new Date(s.check_in_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                                    <span className="opacity-30">→</span>
                                                                    {s.check_out_time ? new Date(s.check_out_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '...'}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-6 text-center opacity-20">
                                                <p className="text-xs font-black uppercase tracking-widest">Нет записей</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })
                    })()}
                </div>
            )}
        </div>
    )
}