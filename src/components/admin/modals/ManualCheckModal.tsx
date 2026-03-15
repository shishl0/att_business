'use client'

import { useState, useEffect } from 'react'
import { ClockAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Employee } from '@/types'

type ManualCheckModalProps = {
    isOpen: boolean
    employee: Employee | null
    type: 'check_in' | 'check_out'
    onClose: () => void
    onSubmit: (employeeId: string, type: 'check_in' | 'check_out', isoString: string) => Promise<void>
}

export default function ManualCheckModal({ isOpen, employee, type, onClose, onSubmit }: ManualCheckModalProps) {
    const [datetime, setDatetime] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            const tzOffsetMs = 5 * 60 * 60 * 1000 // GMT+5
            const now = new Date(Date.now() + tzOffsetMs)
            setDatetime(now.toISOString().slice(0, 16))
            setIsSubmitting(false)
        }
    }, [isOpen])

    if (!isOpen || !employee) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!datetime) return
        setIsSubmitting(true)

        // Append timezone offset to ensure correctness
        const isoString = new Date(`${datetime}+05:00`).toISOString()
        await onSubmit(employee.id, type, isoString)
        setIsSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <ClockAlert className={type === 'check_in' ? 'text-emerald-500' : 'text-rose-500'} />
                    Ручная отметка
                </h3>
                <p className="font-semibold text-gray-700 mb-6 pb-4 border-b">Сотрудник: <span className="text-blue-600">{employee.name}</span></p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Тип отметки</label>
                        <div className={`p-3 rounded-lg border font-bold text-center ${type === 'check_in' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                            {type === 'check_in' ? '🟢 Пришел' : '🔴 Ушел'}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Дата и время</label>
                        <Input type="datetime-local" required value={datetime} onChange={e => setDatetime(e.target.value)} className="h-12" />
                    </div>

                    <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Отмена</Button>
                        <Button type="submit" disabled={isSubmitting} variant={type === 'check_in' ? 'success' : 'destructive'}>Подтвердить</Button>
                    </div>
                </form>
            </div>
        </div>
    )
}
