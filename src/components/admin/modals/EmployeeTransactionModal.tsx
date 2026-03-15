'use client'

import { X } from 'lucide-react'
import { Transaction } from '@/types'

type EmployeeTransactionModalProps = {
    isOpen: boolean
    employeeName: string
    transactions: Transaction[]
    onClose: () => void
}

export default function EmployeeTransactionModal({
    isOpen,
    employeeName,
    transactions,
    onClose
}: EmployeeTransactionModalProps) {
    if (!isOpen) return null

    const balance = transactions.reduce((acc, tx) => {
        return acc + (tx.type === 'accrual' ? tx.amount : -tx.amount)
    }, 0)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-gray-100 flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b shrink-0">
                    <div>
                        <h3 className="text-xl font-extrabold text-gray-900">История транзакций</h3>
                        <p className="text-sm text-blue-600 font-semibold mt-0.5">{employeeName}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Balance Summary */}
                <div className={`mx-6 mt-4 p-4 rounded-xl shrink-0 ${balance >= 0 ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100'}`}>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Текущий баланс</p>
                    <p className={`text-2xl font-extrabold ${balance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {balance.toLocaleString('ru-RU')} ₸
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{transactions.length} операций всего</p>
                </div>

                {/* Transaction List */}
                <div className="overflow-y-auto flex-1 p-6 pt-4 space-y-2">
                    {transactions.length > 0 ? transactions.map(tx => (
                        <div key={tx.id} className="flex flex-col text-sm py-3 border-b border-gray-100 last:border-0">
                            <div className="flex justify-between items-center mb-1">
                                <div>
                                    <span className="text-gray-500 font-medium text-xs block">
                                        {new Date(tx.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })} · {new Date(tx.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="text-gray-700 font-medium">{tx.comment || 'Без комментария'}</span>
                                </div>
                                <span className={`font-extrabold text-base whitespace-nowrap ml-4 ${tx.type === 'accrual' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {tx.type === 'accrual' ? '+' : '−'}{tx.amount.toLocaleString()} ₸
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tx.type === 'accrual' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                    {tx.type === 'accrual' ? 'Начисление' : 'Снятие'}
                                </span>
                                <span className="text-xs text-gray-400">{tx.source === 'system' ? '💻 Система' : '👤 Админ'}</span>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-12 text-gray-400">
                            <p className="text-lg font-semibold mb-1">Нет транзакций</p>
                            <p className="text-sm">Операции появятся здесь после начислений</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
