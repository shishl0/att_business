import { X } from 'lucide-react'

type Transaction = { id: string; amount: number; type: 'accrual' | 'withdrawal'; timestamp: string; comment?: string; source?: string }

type TransactionHistoryModalProps = {
    isOpen: boolean
    transactions: Transaction[]
    onClose: () => void
}

export default function TransactionHistoryModal({
    isOpen,
    transactions,
    onClose
}: TransactionHistoryModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div className="bg-white rounded-t-3xl w-full max-w-sm shadow-2xl p-6 border-t border-gray-100 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6 shrink-0">
                    <h3 className="text-xl font-extrabold text-gray-900">История транзакций</h3>
                    <button onClick={onClose} className="text-gray-400 p-2 hover:bg-gray-100 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                </div>
                <div className="overflow-y-auto space-y-3 pr-2 flex-1 pb-safe">
                    {transactions.length > 0 ? transactions.map(tx => (
                        <div key={tx.id} className="flex flex-col text-sm py-3 border-b border-gray-100 last:border-0">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-gray-500 font-medium">{new Date(tx.timestamp).toLocaleDateString('ru')} {new Date(tx.timestamp).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span className={`font-bold ${tx.type === 'accrual' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {tx.type === 'accrual' ? '+' : '-'}{tx.amount.toLocaleString()} ₸
                                </span>
                            </div>
                            <div className="flex justify-between items-start text-xs opacity-70">
                                <span className="text-gray-600 italic max-w-[70%]">{tx.comment || 'Нет комментария'}</span>
                                <span className="font-semibold text-right">{tx.source === 'system' ? '💻 Система' : '👤 Админ'}</span>
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-gray-400 py-8 font-medium">Транзакций пока нет</p>
                    )}
                </div>
            </div>
        </div>
    )
}
