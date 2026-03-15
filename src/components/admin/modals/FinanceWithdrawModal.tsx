'use client'

import { useState, useEffect } from 'react'
import { Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Employee, Transaction } from '@/types'

type FinanceWithdrawModalProps = {
    isOpen: boolean
    employee: Employee | null
    transactions: Transaction[]
    onClose: () => void
    onSubmit: (employeeId: string, amount: number) => Promise<void>
}

export default function FinanceWithdrawModal({ isOpen, employee, transactions, onClose, onSubmit }: FinanceWithdrawModalProps) {
    const [amount, setAmount] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (isOpen) setAmount('')
    }, [isOpen])

    if (!isOpen || !employee) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)
        await onSubmit(employee.id, Number(amount))
        setIsSubmitting(false)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100 flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className="text-xl font-bold flex items-center gap-2"><Wallet className="text-blue-600" /> Снятие средств</h3>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 rounded-full" onClick={onClose} disabled={isSubmitting}><X className="w-4 h-4" /></Button>
                </div>

                <div className="overflow-y-auto pr-2">
                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 mb-6 shrink-0">
                        <p className="text-sm text-blue-800 font-medium">Текущий депозит</p>
                        <h4 className="text-3xl font-extrabold text-blue-900 mt-1">{employee.balance?.toLocaleString('ru-RU')} ₸</h4>
                        <p className="text-sm text-blue-600/70 mt-1">{employee.name}</p>
                    </div>

                    <form onSubmit={handleSubmit} className="shrink-0">
                        <div className="space-y-2 mb-6">
                            <label className="text-sm font-bold text-gray-700">Сумма к выдаче</label>
                            <div className="relative">
                                <Input type="number" required max={employee.balance || 0} placeholder="Например, 5000" value={amount} onChange={e => setAmount(e.target.value)} className="pl-4 pr-12 h-14 text-lg font-semibold" autoFocus />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400  font-bold px-2">₸</span>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <Button type="button" variant="outline" className="h-11" onClick={onClose} disabled={isSubmitting}>Отмена</Button>
                            <Button type="submit" variant="success" className="h-11 shadow-sm" disabled={isSubmitting}><Wallet className="w-4 h-4 mr-2" /> Снять</Button>
                        </div>
                    </form>

                    {/* Mini internal history */}
                    <div className="mt-8 shrink-0">
                        <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Последние операции (10)</h5>
                        <div className="space-y-3">
                            {transactions.filter(t => t.employee_id === employee.id).slice(0, 10).map(tx => (
                                <div key={tx.id} className="flex flex-col text-sm py-2 border-b border-gray-50 last:border-0">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-gray-500 font-medium">{new Date(tx.timestamp).toLocaleDateString('ru')} {new Date(tx.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
                                        <span className={`font-bold ${tx.type === 'accrual' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {tx.type === 'accrual' ? '+' : '-'}{tx.amount.toLocaleString()} ₸
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs opacity-70">
                                        <span>{tx.source === 'system' ? '💻 Система' : '👤 Администратор'}</span>
                                    </div>
                                </div>
                            ))}
                            {transactions.filter(t => t.employee_id === employee.id).length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-2">Нет записей</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
