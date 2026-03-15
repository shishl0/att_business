'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ClockAlert } from 'lucide-react'
import { Shift } from '@/types'
import { WEEKDAYS } from '@/lib/constants'
import { getDaysInMonth, getFirstDayOfMonth } from '@/lib/utils/date'

type CalendarTabProps = {
    calendarShifts: Record<string, Shift[]>
}

export default function CalendarTab({ calendarShifts }: CalendarTabProps) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [calendarView, setCalendarView] = useState<'month' | 'week'>('month')

    // Auto-switch to week view on mobile
    useEffect(() => {
        const checkMobile = () => {
            if (window.innerWidth < 1024) {
                setCalendarView('week')
            } else {
                setCalendarView('month')
            }
        }
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    const renderCalendarCell = (year: number, month: number, day: number) => {
        if (day === 0) return <div className="min-h-[140px] bg-gray-50/50 border border-gray-100 rounded-lg p-2 opacity-50"></div>

        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const dayShifts = calendarShifts[dStr] || []

        // Group shifts by employee for this cell
        const groupedShifts: Record<string, Shift[]> = {}
        dayShifts.forEach((s: Shift) => {
            if (!groupedShifts[s.employee_name]) groupedShifts[s.employee_name] = []
            groupedShifts[s.employee_name].push(s)
        })

        return (
            <div className="min-h-[140px] h-full border border-gray-200 rounded-xl bg-white p-3 hover:shadow-md transition-shadow relative group">
                <span className="text-sm font-bold text-gray-400 absolute top-3 right-3">{day}</span>
                <div className="mt-6 flex flex-col gap-2">
                    {Object.entries(groupedShifts).map(([empName, empShifts]) => {
                        const hasOvertime = empShifts.some((s: Shift) => s.is_overtime)
                        const hasLate = empShifts.some((s: Shift) => s.is_late)
                        return (
                            <div key={empName} className={`p-2 rounded-lg text-xs font-semibold shadow-sm border ${hasOvertime ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-blue-50 border-blue-100 text-blue-900'} flex flex-col gap-1`}>
                                <div className="flex justify-between items-center gap-2">
                                    <span className="truncate" title={empName}>{empName}</span>
                                    <div className="flex gap-1 shrink-0">
                                        {hasLate && <span className="bg-rose-500 text-white text-[9px] px-1 rounded uppercase tracking-wider">Опоздал</span>}
                                        {hasOvertime && <ClockAlert className="w-3.5 h-3.5 text-orange-600" />}
                                    </div>
                                </div>
                                {empShifts.map((s: Shift, i: number) => {
                                    const inT = s.check_in_time ? new Date(s.check_in_time) : null
                                    const outT = s.check_out_time ? new Date(s.check_out_time) : null
                                    const isNextDay = outT && inT && outT.getDate() !== inT.getDate()

                                    return (
                                        <div key={i} className="text-[10px] opacity-70 flex justify-between border-t border-black/5 pt-1 mt-1 first:border-0 first:pt-0 first:mt-0">
                                            <span>{inT ? inT.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                                            <span> - </span>
                                            <span>
                                                {outT ? outT.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : 'Сейчас'}
                                                {isNextDay && <span className="ml-1 text-[8px] font-bold opacity-80">(след.д)</span>}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        )
                    })}
                    {dayShifts.length === 0 && <span className="text-xs text-gray-300 mx-auto mt-2">Нет записей</span>}
                </div>
            </div>
        )
    }

    const renderMonth = () => {
        const year = currentDate.getFullYear()
        const month = currentDate.getMonth()

        if (calendarView === 'month') {
            const daysInMonth = getDaysInMonth(year, month)
            const firstDay = getFirstDayOfMonth(year, month)

            const calendarDays = Array(firstDay).fill(0).concat(
                Array.from({ length: daysInMonth }, (_, i) => i + 1)
            )

            return (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 gap-4">
                        <Button variant="outline" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-full sm:w-auto">
                            Пред. месяц
                        </Button>
                        <h3 className="font-extrabold text-lg md:text-xl text-gray-800 capitalize text-center">
                            {currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
                        </h3>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="secondary" onClick={() => setCalendarView('week')} className="flex-1">5 дней</Button>
                            <Button variant="outline" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="flex-1">
                                След. месяц
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                        {WEEKDAYS.map(day => (
                            <div key={day} className="hidden lg:block text-center font-bold text-gray-500 text-sm py-2">
                                {day}
                            </div>
                        ))}
                        {calendarDays.map((day, i) => (
                            <div key={i} className={day === 0 ? "hidden lg:block" : ""}>
                                {renderCalendarCell(year, month, day)}
                            </div>
                        ))}
                    </div>
                </div>
            )
        } else {
            // 5-Day View (Current Date + 2, Current Date - 2)
            const days = []
            for (let i = -2; i <= 2; i++) {
                const d = new Date(currentDate)
                d.setDate(d.getDate() + i)
                days.push(d)
            }

            return (
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 gap-4">
                        <Button variant="outline" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 5); setCurrentDate(d) }} className="w-full sm:w-auto">
                            Назад
                        </Button>
                        <h3 className="font-extrabold text-lg md:text-xl text-gray-800 capitalize text-center">
                            {currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
                        </h3>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="secondary" onClick={() => setCalendarView('month')} className="flex-1 hidden lg:block">Месяц</Button>
                            <Button variant="outline" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 5); setCurrentDate(d) }} className="flex-1">
                                Вперед
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                        {days.map((d, i) => {
                            const dayName = d.toLocaleDateString('ru-RU', { weekday: 'short' })
                            return (
                                <div key={i} className="flex flex-col">
                                    <div className="text-center font-bold text-gray-500 text-sm py-2 capitalize">
                                        {dayName}, {d.getDate()}
                                    </div>
                                    {renderCalendarCell(d.getFullYear(), d.getMonth(), d.getDate())}
                                </div>
                            )
                        })}
                    </div>
                </div>
            )
        }
    }

    return (
        <div className="animate-in fade-in zoom-in-95 duration-200">
            {renderMonth()}
        </div>
    )
}
