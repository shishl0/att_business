import { useState } from 'react'
import { Loader2 } from 'lucide-react'

type EarlyLeaveModalProps = {
    isOpen: boolean
    isSubmitting: boolean
    onClose: () => void
    onSubmit: (reason: string) => Promise<void>
}

export default function EarlyLeaveModal({
    isOpen,
    isSubmitting,
    onClose,
    onSubmit
}: EarlyLeaveModalProps) {
    const [reason, setReason] = useState('')

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!reason.trim()) return
        await onSubmit(reason)
        setReason('')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Ранний уход</h3>
                <p className="text-sm text-gray-600 mb-5">
                    Ваша смена еще не окончена. Пожалуйста, укажите причину раннего ухода. Работодатель увидит её в системе.
                </p>
                <form onSubmit={handleSubmit}>
                    <textarea
                        className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none mb-6 h-28"
                        placeholder="Причина ухода..."
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        autoFocus
                    />
                    <div className="flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            Отмена
                        </button>
                        <button
                            type="submit"
                            disabled={!reason.trim() || isSubmitting}
                            className="px-5 py-2.5 rounded-xl font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors flex items-center"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Завершить
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
