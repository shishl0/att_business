'use client'

import { useState, useEffect } from 'react'
import { Landmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Employee, Schedule } from '@/types'

type AccrualModalProps = {
    isOpen: boolean
    employee: Employee | null
    schedules: Schedule[]
    onClose: () => void
    onSubmit: (employeeId: string, amount: number) => Promise<void>
}

export default function AccrualModal({ isOpen, employee, schedules, onClose, onSubmit }: AccrualModalProps) {
    const [amount, setAmount] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Auto-fill amount based on today's schedule
    useEffect(() => {
        if (isOpen && employee) {
            const tzOffsetMs = 5 * 60 * 60 * 1000 // GMT+5
            const nowLocal = new Date(Date.now() + tzOffsetMs)
            const dayOfWeek = nowLocal.getDay() || 7

            const todaySched = schedules.find(s => s.employee_id === employee.id && s.day_of_week === dayOfWeek)

            let defaultSalary = 5000
            if (todaySched && todaySched.shift_salary) {
                defaultSalary = todaySched.shift_salary
            }
            setAmount(defaultSalary.toString())
        }
    }, [isOpen, employee, schedules])

    if (!isOpen || !employee) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        await onSubmit(employee.id, Number(amount))
        setIsSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Landmark className="text-emerald-500 w-6 h-6" />
                    Начисление зарплаты
                </h3>
                <p className="font-semibold text-gray-700 mb-6 pb-4 border-b">Сотрудник: <span className="text-blue-600">{employee.name}</span></p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700">Сумма зачисления (₸)</label>
                        <div className="relative mt-2">
                            <Input type="number" required placeholder="Например, 5000" min="0" step="10" value={amount} onChange={e => setAmount(e.target.value)} className="pl-4 pr-12 h-14 text-lg font-semibold border-emerald-200 focus-visible:ring-emerald-500" autoFocus />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₸</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Сумма автоматически подтянута из расписания на сегодня (если есть).</p>
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-100">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Отмена</Button>
                        <Button type="submit" variant="success" disabled={isSubmitting}>Зачислить</Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
