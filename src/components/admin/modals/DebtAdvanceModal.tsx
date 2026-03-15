'use client'

import { useState, useEffect } from 'react'
import { HandCoins, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Employee } from '@/types'

type DebtAdvanceModalProps = {
    isOpen: boolean
    employee: Employee | null
    onClose: () => void
    onSubmit: (employeeId: string, amount: number, comment: string) => Promise<void>
}

export default function DebtAdvanceModal({ isOpen, employee, onClose, onSubmit }: DebtAdvanceModalProps) {
    const [amount, setAmount] = useState('')
    const [comment, setComment] = useState('Аванс')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setAmount('')
            setComment('Аванс')
        }
    }, [isOpen])

    if (!isOpen || !employee) return null

    const handleSubmit = async () => {
        setIsSubmitting(true)
        await onSubmit(employee.id, Number(amount), comment)
        setIsSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2"><HandCoins className="text-rose-600" /> Начислить аванс / долг</h3>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 rounded-full" onClick={onClose} disabled={isSubmitting}><X className="w-4 h-4" /></Button>
                </div>

                <div className="bg-rose-50/50 rounded-xl p-4 border border-rose-100 mb-6">
                    <p className="text-sm text-rose-800 font-medium">Сотрудник</p>
                    <h4 className="text-xl font-extrabold text-rose-900 mt-1">{employee.name}</h4>
                    <p className="text-sm text-rose-600/70 mt-1">Текущий баланс: {employee.balance?.toLocaleString('ru-RU')} ₸</p>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">Сумма (тг)</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 font-bold">₸</span>
                            <Input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="pl-10 h-14 text-lg font-bold" placeholder="Например: 2000" />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">* Эта сумма будет вычтена из депозита (баланса) сотрудника.</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-2">Комментарий</label>
                        <Input type="text" required value={comment} onChange={e => setComment(e.target.value)} className="h-14" placeholder="Аванс" />
                    </div>
                </div>

                <Button disabled={isSubmitting} className="w-full h-14 mt-6 text-lg font-bold bg-rose-600 hover:bg-rose-700 text-white" onClick={handleSubmit}>Подтвердить долг/аванс</Button>
            </div>
        </div>
    )
}
