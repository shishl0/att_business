'use client'

import { useState, DragEvent } from 'react'
import {
    GripVertical, Edit2, Trash2, Plus, Calendar,
    Clock, User, LayoutGrid, List, ChevronRight, Info, Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Employee, Schedule } from '@/types'
import { WEEKDAYS } from '@/lib/constants'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

type ScheduleTabProps = {
    employees: Employee[]
    schedules: Schedule[]
    onDropToDay: (emp: Employee, dayIndex: number) => void
    onEditSchedule: (sched: Schedule) => void
    onDeleteSchedule: (id: string) => void
}

export default function ScheduleTab({
    employees,
    schedules,
    onDropToDay,
    onEditSchedule,
    onDeleteSchedule
}: ScheduleTabProps) {
    const [draggedEmp, setDraggedEmp] = useState<Employee | null>(null)
    const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
    const [scheduleViewMode, setScheduleViewMode] = useState<'week' | 'day'>('week')
    const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0)

    const handleDragStart = (e: DragEvent, emp: Employee) => {
        setDraggedEmp(emp)
        e.dataTransfer.effectAllowed = 'copy'
    }

    const handleDropLocal = (e: DragEvent | null, dayIndex: number, empOverride?: Employee) => {
        if (e) e.preventDefault()
        const emp = empOverride || draggedEmp
        if (!emp) return
        onDropToDay(emp, dayIndex)
        if (!e) setSelectedEmpId(null)
    }

    return (
        <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200">

            {/* ВЕРХНЯЯ ПАНЕЛЬ: Переключатели */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-800">Расписание смен</h2>
                </div>

                <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
                    <button
                        onClick={() => setScheduleViewMode('week')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${scheduleViewMode === 'week' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Сетка
                    </button>
                    <button
                        onClick={() => setScheduleViewMode('day')}
                        className={`flex-1 sm:flex-none px-6 py-2 rounded-lg text-sm font-bold transition-all ${scheduleViewMode === 'day' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Таймлайн
                    </button>
                </div>
            </div>

            {/* ОСНОВНОЙ КОНТЕНТ: Сетка 1 : 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">

                {/* ЛЕВАЯ КОЛОНКА: Сотрудники */}
                <aside className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden sticky top-6">
                    <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center">
                        <span className="font-bold text-slate-700 text-sm flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-400" /> Команда
                        </span>
                    </div>

                    <div className="p-3 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto max-h-[600px] no-scrollbar">
                        {employees.filter(e => e.is_active).map(emp => (
                            <div
                                key={emp.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, emp)}
                                onClick={() => setSelectedEmpId(selectedEmpId === emp.id ? null : emp.id)}
                                className={`group flex items-center gap-3 p-3.5 rounded-2xl border transition-all cursor-grab active:cursor-grabbing shrink-0 min-w-[240px] lg:min-w-0 px-2 h-12 ${selectedEmpId === emp.id
                                    ? 'bg-indigo-600 border-indigo-600 shadow-lg shadow-indigo-100'
                                    : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${selectedEmpId === emp.id ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                                    {emp.name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold truncate ${selectedEmpId === emp.id ? 'text-white' : 'text-slate-700'}`}>{emp.name}</p>
                                    <p className={`text-[10px] font-bold uppercase ${selectedEmpId === emp.id ? 'text-indigo-100/80' : 'text-slate-400'}`}>Сотрудник</p>
                                </div>
                                <ChevronRight className={`w-4 h-4 transition-transform lg:block hidden ${selectedEmpId === emp.id ? 'text-white translate-x-1' : 'text-slate-200 opacity-0 group-hover:opacity-100'}`} />
                            </div>
                        ))}
                    </div>
                </aside>

                {/* ПРАВАЯ КОЛОНКА: Сетка смен */}
                <main className="min-w-0">
                    {scheduleViewMode === 'week' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {WEEKDAYS.map((day, dIdx) => {
                                const daySchedules = schedules.filter(s => s.day_of_week === dIdx + 1)
                                const isSelected = !!selectedEmpId;

                                return (
                                    <div
                                        key={day}
                                        onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('ring-4', 'ring-indigo-100', 'bg-indigo-50/50') }}
                                        onDragLeave={e => e.currentTarget.classList.remove('ring-4', 'ring-indigo-100', 'bg-indigo-50/50')}
                                        onDrop={e => { e.currentTarget.classList.remove('ring-4', 'ring-indigo-100', 'bg-indigo-50/50'); handleDropLocal(e, dIdx) }}
                                        onClick={() => isSelected && handleDropLocal(null, dIdx, employees.find(e => e.id === selectedEmpId))}
                                        className={`flex flex-col min-h-[320px] bg-white rounded-xl border transition-all duration-300 ${isSelected
                                            ? 'border-indigo-400 border-dashed cursor-pointer bg-indigo-50/10'
                                            : 'border-slate-200 shadow-sm hover:shadow-md'
                                            }`}
                                    >
                                        <div className="p-5 flex justify-between items-center bg-slate-50/30 border-b border-slate-50 rounded-t-[2.5rem]">
                                            <span className="font-black text-slate-800 uppercase tracking-widest text-[11px]">{day}</span>
                                            <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-bold text-indigo-500 border border-indigo-50">
                                                {daySchedules.length}
                                            </span>
                                        </div>

                                        <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[400px]">
                                            {daySchedules.map(sched => (
                                                <div key={sched.id} className="group relative bg-white border border-slate-100 p-4 rounded-2xl transition-all shadow-sm hover:border-indigo-200">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-xs font-black text-slate-700 truncate block">{sched.employees?.name}</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); onDeleteSchedule(sched.id) }}
                                                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-500 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-600 px-3 py-1.5 rounded-xl text-[10px] font-black border border-slate-100">
                                                            <Clock className="w-3 h-3 text-indigo-500" />
                                                            {sched.start_time.substring(0, 5)} — {sched.end_time.substring(0, 5)}
                                                        </div>
                                                        <button onClick={(e) => { e.stopPropagation(); onEditSchedule(sched) }} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-100 rounded-lg">
                                                            <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}

                                            {daySchedules.length === 0 && !isSelected && (
                                                <div className="h-full flex flex-col items-center justify-center py-12 opacity-20 border-2 border-dashed border-slate-200 rounded-3xl">
                                                    <Plus className="w-6 h-6 mb-1" />
                                                    <p className="text-[10px] font-bold uppercase tracking-tighter">Пусто</p>
                                                </div>
                                            )}

                                            {isSelected && (
                                                <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-indigo-200 rounded-[2rem] py-12 bg-indigo-50/20">
                                                    <Plus className="w-6 h-6 text-indigo-400 animate-bounce" />
                                                    <p className="text-[10px] font-black text-indigo-500 uppercase mt-2">Добавить смену</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}

                            {/* Заполнители для сетки 3х3 (блок 8) */}
                            <div className="hidden xl:flex flex-col bg-slate-100/50 rounded-xl border border-dashed border-slate-300 p-6 items-center justify-center text-center opacity-60">
                                <Info className="w-8 h-8 text-slate-400 mb-2" />
                                <p className="text-xs font-bold text-slate-500 uppercase">Статистика недели</p>
                                <p className="text-[10px] text-slate-400 mt-1">Всего смен: {schedules.length}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
                                {WEEKDAYS.map((day, idx) => (
                                    <button
                                        key={day}
                                        onClick={() => setSelectedDayIdx(idx)}
                                        className={`px-5 py-2 text-[11px] font-black uppercase rounded-xl transition-all whitespace-nowrap ${selectedDayIdx === idx
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'bg-white text-slate-400 hover:text-slate-600 border border-slate-100'}`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>
                            <div className="overflow-x-auto p-8 no-scrollbar">
                                <div className="min-w-[1000px]">
                                    {/* Часовая шкала */}
                                    <div className="flex ml-40 border-b border-slate-100 pb-4 mb-6">
                                        {Array.from({ length: 24 }).map((_, h) => (
                                            <div key={h} className="flex-1 text-[10px] font-black text-slate-400 text-center relative border-l border-slate-50">
                                                <span className="absolute -top-1 left-2">{h.toString().padStart(2, '0')}:00</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-4">
                                        {schedules.filter(s => s.day_of_week === selectedDayIdx + 1).map(sched => {
                                            const [sH, sM] = sched.start_time.split(':').map(Number)
                                            const [eH, eM] = sched.end_time.split(':').map(Number)
                                            const start = sH + (sM / 60)
                                            let end = eH + (eM / 60)
                                            if (end < start) end += 24
                                            return (
                                                <div key={sched.id} className="flex items-center group">
                                                    <div className="w-40 shrink-0 flex items-center gap-3 pr-4">
                                                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black uppercase shrink-0">
                                                            {sched.employees?.name.charAt(0)}
                                                        </div>
                                                        <span className="text-xs font-bold text-slate-700 truncate">{sched.employees?.name}</span>
                                                    </div>
                                                    <div className="flex-1 relative h-10 bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                                        <div
                                                            className="absolute h-6 top-2 bg-indigo-500 hover:bg-indigo-600 transition-all rounded-lg shadow-sm flex items-center px-3 text-[9px] font-black text-white cursor-pointer z-10 border border-white/20 whitespace-nowrap"
                                                            style={{ left: `${(start / 24) * 100}%`, width: `${((end - start) / 24) * 100}%` }}
                                                            onClick={() => onEditSchedule(sched)}
                                                        >
                                                            {sched.start_time.substring(0, 5)} - {sched.end_time.substring(0, 5)}
                                                        </div>
                                                        <div className="absolute inset-0 flex pointer-events-none opacity-30">
                                                            {Array.from({ length: 24 }).map((_, h) => <div key={h} className="flex-1 border-l border-slate-200 h-full" />)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    )
}