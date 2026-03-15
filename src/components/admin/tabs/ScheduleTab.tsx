'use client'

import { useState, DragEvent } from 'react'
import { GripVertical, Edit2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Employee, Schedule } from '@/types'
import { WEEKDAYS } from '@/lib/constants'

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
    }

    return (
        <div className="animate-in fade-in zoom-in-95 duration-200 flex flex-col lg:flex-row gap-6">

            {/* Draggable Employees List */}
            <div className="w-full lg:w-64 bg-gray-50 border border-gray-200 rounded-xl p-4 shrink-0 flex flex-col max-h-[700px]">
                <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex justify-between items-center">
                    <span>Сотрудники</span>
                    <GripVertical className="w-4 h-4 text-gray-400" />
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                        На десктопе: перетащите карточку. <br />
                        На мобильном: нажмите на сотрудника, затем на день.
                    </p>
                    {employees.filter(e => e.is_active).map(emp => (
                        <div
                            key={emp.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, emp)}
                            onClick={() => setSelectedEmpId(selectedEmpId === emp.id ? null : emp.id)}
                            className={`bg-white border rounded-lg p-3 shadow-sm cursor-pointer lg:cursor-grab active:lg:cursor-grabbing transition-all flex items-center gap-3 ${selectedEmpId === emp.id ? 'border-blue-600 ring-2 ring-blue-100 bg-blue-50' : 'border-gray-200 hover:border-blue-400'
                                }`}
                        >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${selectedEmpId === emp.id ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                                {emp.name.charAt(0)}
                            </div>
                            <span className={`font-semibold text-sm truncate ${selectedEmpId === emp.id ? 'text-blue-900' : 'text-gray-800'}`}>{emp.name}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Weekly/Daily Grid */}
            <div className="flex-1 flex flex-col gap-4">

                {/* View Toggles & Day Selector */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm gap-4">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${scheduleViewMode === 'week' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setScheduleViewMode('week')}
                        >
                            Неделя
                        </button>
                        <button
                            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${scheduleViewMode === 'day' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                            onClick={() => setScheduleViewMode('day')}
                        >
                            День
                        </button>
                    </div>

                    {scheduleViewMode === 'day' && (
                        <div className="flex flex-wrap gap-1">
                            {WEEKDAYS.map((day, idx) => (
                                <button
                                    key={day}
                                    onClick={() => setSelectedDayIdx(idx)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedDayIdx === idx ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                                >
                                    {day}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {scheduleViewMode === 'week' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-3">
                        {WEEKDAYS.map((day, dIdx) => {
                            const daySchedules = schedules.filter(s => s.day_of_week === dIdx + 1)
                            return (
                                <div
                                    key={day}
                                    className={`bg-gray-50/50 border border-gray-200 rounded-xl flex flex-col overflow-hidden transition-colors cursor-pointer lg:cursor-default ${selectedEmpId ? 'ring-2 ring-blue-300 border-blue-400 bg-blue-50/50' : ''}`}
                                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-100') }}
                                    onDragLeave={e => e.currentTarget.classList.remove('bg-blue-100')}
                                    onDrop={e => { e.currentTarget.classList.remove('bg-blue-100'); handleDropLocal(e, dIdx) }}
                                    onClick={() => {
                                        if (selectedEmpId) {
                                            const emp = employees.find(e => e.id === selectedEmpId)
                                            if (emp) handleDropLocal(null, dIdx, emp)
                                        }
                                    }}
                                >
                                    <div className="bg-white border-b border-gray-200 p-3 text-center font-bold text-gray-700">
                                        {day}
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col gap-2 min-h-[150px]">
                                        {daySchedules.map(sched => (
                                            <div key={sched.id} className="bg-white border text-left border-gray-200 rounded-lg p-3 shadow-sm group">
                                                <div className="font-bold text-sm text-gray-900 truncate mb-2">{sched.employees?.name}</div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                                        {sched.start_time.substring(0, 5)} - {sched.end_time.substring(0, 5)}
                                                    </span>
                                                </div>
                                                <div className="mt-3 flex gap-2">
                                                    <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={() => onEditSchedule(sched)}>
                                                        <Edit2 className="w-3 h-3 mr-1" />
                                                    </Button>
                                                    <Button size="sm" variant="destructive" className="h-7 w-full text-xs" onClick={() => onDeleteSchedule(sched.id)}>
                                                        <X className="w-3 h-3 mr-1" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                        {daySchedules.length === 0 && (
                                            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl m-1">
                                                <span className="text-xs font-semibold text-gray-400 rotate-0 md:-rotate-90 xl:rotate-0 px-4 text-center">Перетащите сюда</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
                        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                            <h4 className="font-bold text-gray-800 text-lg">{WEEKDAYS[selectedDayIdx]} <span className="text-sm font-normal text-gray-500 ml-2">(Таймлайн)</span></h4>
                            <p className="text-xs text-gray-500">Нажмите на полосу, чтобы изменить</p>
                        </div>
                        <div className="overflow-x-auto p-4">
                            <div className="min-w-[800px]">
                                {/* Timeline Header (hours) */}
                                <div className="flex border-b border-gray-200 ml-32 pl-4">
                                    {Array.from({ length: 24 }).map((_, h) => (
                                        <div key={h} className="flex-1 text-[10px] font-bold text-gray-400 text-center py-2 border-l border-gray-100 relative">
                                            <span className="-translate-x-1/2 absolute left-0">{h}:00</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Timeline Body */}
                                <div className="mt-4 space-y-4">
                                    {schedules.filter(s => s.day_of_week === selectedDayIdx + 1).length === 0 ? (
                                        <div className="text-center py-10 text-gray-400 text-sm font-medium">Нет смен в этот день</div>
                                    ) : (
                                        schedules.filter(s => s.day_of_week === selectedDayIdx + 1).map(sched => {
                                            const [sH, sM] = sched.start_time.split(':').map(Number)
                                            const [eH, eM] = sched.end_time.split(':').map(Number)
                                            const start = sH + (sM / 60)
                                            let end = eH + (eM / 60)
                                            let duration = end - start

                                            let isOvernight = false
                                            if (duration < 0) {
                                                duration += 24
                                                isOvernight = true
                                            }

                                            const left = (start / 24) * 100
                                            const width = (duration / 24) * 100

                                            return (
                                                <div key={sched.id} className="flex items-center">
                                                    <div className="w-32 truncate text-sm font-bold text-gray-800 pr-2 pb-1">{sched.employees?.name}</div>
                                                    <div className="flex-1 relative h-12 bg-gray-50/50 rounded-lg border border-gray-100 flex items-center ml-4">
                                                        <div
                                                            className="absolute h-8 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-colors rounded shadow-sm flex items-center px-2 text-xs font-bold text-white cursor-pointer z-10 overflow-hidden"
                                                            style={{ left: `${left}%`, width: `${width}%` }}
                                                            onClick={() => onEditSchedule(sched)}
                                                            title={`${sched.start_time.substring(0, 5)} - ${sched.end_time.substring(0, 5)} (Нажмите для ред.)`}
                                                        >
                                                            <span className="truncate drop-shadow-sm">{sched.start_time.substring(0, 5)} - {sched.end_time.substring(0, 5)} {isOvernight && '(след.д)'}</span>
                                                        </div>
                                                        {/* Grid guides for rows */}
                                                        <div className="absolute inset-0 flex pointer-events-none">
                                                            {Array.from({ length: 24 }).map((_, h) => (
                                                                <div key={h} className="flex-1 border-l border-gray-100/50 h-full"></div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
