'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Employee } from '@/types'

type ScheduleEditModalProps = {
    isOpen: boolean
    isEditingId: string | null
    employee: Employee | null
    dayIndex: number // 1 to 7
    initialStart?: string
    initialEnd?: string
    initialSalary?: string
    onClose: () => void
    onSubmit: (employeeId: string, dayIndex: number, start: string, end: string, salary: number, editingId: string | null) => Promise<void>
}

export default function ScheduleEditModal({
    isOpen,
    isEditingId,
    employee,
    dayIndex,
    initialStart = '09:00',
    initialEnd = '22:00',
    initialSalary = '5000',
    onClose,
    onSubmit
}: ScheduleEditModalProps) {
    const [startInput, setStartInput] = useState(initialStart)
    const [endInput, setEndInput] = useState(initialEnd)
    const [salaryInput, setSalaryInput] = useState(initialSalary)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Sync props to state on open
    useEffect(() => {
        if (isOpen) {
            setStartInput(initialStart)
            setEndInput(initialEnd)
            setSalaryInput(initialSalary)
            setIsSubmitting(false)
        }
    }, [isOpen, initialStart, initialEnd, initialSalary])

    if (!isOpen || !employee) return null

    const handleSubmit = async () => {
        setIsSubmitting(true)
        await onSubmit(
            employee.id,
            dayIndex,
            startInput,
            endInput,
            Number(salaryInput) || 0,
            isEditingId
        )
        setIsSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold mb-4">{isEditingId ? 'Изменить расписание' : 'Добавить в расписание'}</h3>
                <p className="font-semibold text-gray-700 mb-6 pb-4 border-b">Сотрудник: <span className="text-blue-600">{employee.name}</span></p>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Время начала</label>
                        <Input type="time" value={startInput} onChange={e => setStartInput(e.target.value)} className="h-12" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Время окончания</label>
                        <Input type="time" value={endInput} onChange={e => setEndInput(e.target.value)} className="h-12" />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Зарплата за смену (тг)</label>
                        <Input type="number" value={salaryInput} onChange={e => setSalaryInput(e.target.value)} className="h-12" />
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>Отмена</Button>
                        <Button variant="success" onClick={handleSubmit} disabled={isSubmitting}>Сохранить</Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
