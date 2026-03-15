'use client'

import { useState } from 'react'
import { RefreshCw, Download, Trash2, Pencil, Check, X, ClockAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Log } from '@/types'

type LogsTabProps = {
    logs: Log[]
    manualRefresh: () => void
    onExportExcel: () => void
    onClearAll: () => Promise<void>
    onForceCheckOut: (id: string, name: string) => Promise<void>
    onDeleteLog: (logId: string) => Promise<void>
    onUpdateLogTimestamp: (logId: string, newTimestamp: string) => Promise<void>
    onAutoCloseShifts: () => Promise<void>
}

export default function LogsTab({
    logs,
    manualRefresh,
    onExportExcel,
    onClearAll,
    onForceCheckOut,
    onDeleteLog,
    onUpdateLogTimestamp,
    onAutoCloseShifts
}: LogsTabProps) {
    const [editingLogId, setEditingLogId] = useState<string | null>(null)
    const [editTimestamp, setEditTimestamp] = useState('')
    const [loadingId, setLoadingId] = useState<string | null>(null)
    const [isClearingAll, setIsClearingAll] = useState(false)
    const [isAutoClosing, setIsAutoClosing] = useState(false)

    const toLocalInput = (isoStr: string) => {
        const tzOffsetMs = 5 * 60 * 60 * 1000
        return new Date(new Date(isoStr).getTime() + tzOffsetMs).toISOString().slice(0, 16)
    }

    const startEditing = (log: Log) => {
        setEditingLogId(log.id)
        setEditTimestamp(toLocalInput(log.timestamp))
    }

    const cancelEditing = () => {
        setEditingLogId(null)
        setEditTimestamp('')
    }

    const handleSaveEdit = async (logId: string) => {
        if (!editTimestamp) return
        setLoadingId(logId)
        const isoString = new Date(`${editTimestamp}+05:00`).toISOString()
        await onUpdateLogTimestamp(logId, isoString)
        setEditingLogId(null)
        setLoadingId(null)
    }

    const handleDelete = async (logId: string) => {
        setLoadingId(logId)
        await onDeleteLog(logId)
        setLoadingId(null)
    }

    const handleClearAll = async () => {
        setIsClearingAll(true)
        await onClearAll()
        setIsClearingAll(false)
    }

    const handleAutoClose = async () => {
        setIsAutoClosing(true)
        await onAutoCloseShifts()
        setIsAutoClosing(false)
    }

    const isLatestCheckIn = (currentLog: Log) => {
        if (currentLog.type !== 'check_in') return false;
        const employeeLogs = logs.filter(l => l.employee_id === currentLog.employee_id);
        const latestLog = employeeLogs.reduce((prev, current) => {
            return new Date(prev.timestamp) > new Date(current.timestamp) ? prev : current;
        });
        return latestLog.id === currentLog.id;
    };

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-bold text-gray-900 px-1">Журнал событий</h2>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button onClick={manualRefresh} variant="outline" className="flex-1 sm:flex-none gap-2 text-sm h-10">
                        <RefreshCw className="w-4 h-4" /> Обновить
                    </Button>
                    <Button onClick={handleAutoClose} variant="outline" className="flex-1 sm:flex-none gap-2 text-sm h-10 text-orange-600 border-orange-200 hover:bg-orange-50" disabled={isAutoClosing}>
                        <ClockAlert className="w-4 h-4" /> {isAutoClosing ? 'Закрываем...' : 'Авто-закрытие'}
                    </Button>
                    <Button onClick={onExportExcel} variant="success" className="flex-1 sm:flex-none gap-2 text-sm h-10">
                        <Download className="w-4 h-4" /> Excel
                    </Button>
                    <Button onClick={handleClearAll} variant="destructive" className="w-full sm:w-auto gap-2 text-sm h-10" disabled={isClearingAll}>
                        <Trash2 className="w-4 h-4" /> {isClearingAll ? 'Очищаем...' : 'Очистить логи'}
                    </Button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium whitespace-nowrap">
                        <tr>
                            <th className="px-4 py-4">Сотрудник</th>
                            <th className="px-4 py-4">Событие</th>
                            <th className="px-4 py-4">Время</th>
                            <th className="px-4 py-4">IP Адрес</th>
                            <th className="px-4 py-4 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                        {logs.map(log => (
                            <tr key={log.id} className={`hover:bg-gray-50 transition-colors ${loadingId === log.id ? 'opacity-50' : ''}`}>
                                <td className="px-4 py-4 font-semibold text-gray-900 whitespace-nowrap">{log.employees?.name || 'Удаленный сотрудник'}</td>
                                <td className="px-4 py-4">
                                    {log.type === 'check_in' && <span className="inline-flex px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200">🟢 Пришел</span>}
                                    {log.type === 'check_out' && <span className="inline-flex px-3 py-1 bg-rose-100 text-rose-800 rounded-lg text-xs font-bold border border-rose-200">🔴 Ушел</span>}
                                    {log.type === 'break_start' && <span className="inline-flex px-3 py-1 bg-purple-100 text-purple-800 rounded-lg text-xs font-bold border border-purple-200">☕ Перерыв</span>}
                                    {log.type === 'break_end' && <span className="inline-flex px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold border border-blue-200">💻 С перерыва</span>}
                                    {log.comment && (
                                        <div className="mt-1 text-xs text-rose-600 font-medium max-w-xs whitespace-normal bg-rose-50 p-1.5 rounded-md border border-rose-100">
                                            💬 {log.comment}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-4 text-gray-700 whitespace-nowrap font-medium">
                                    {editingLogId === log.id ? (
                                        <Input
                                            type="datetime-local"
                                            value={editTimestamp}
                                            onChange={e => setEditTimestamp(e.target.value)}
                                            className="h-8 text-xs w-44"
                                        />
                                    ) : (
                                        new Date(log.timestamp).toLocaleString('ru-RU')
                                    )}
                                </td>
                                <td className="px-4 py-4 text-gray-500 font-mono text-[12px]">{log.ip_address}</td>
                                <td className="px-4 py-4">
                                    <div className="flex gap-1 justify-end">
                                        {editingLogId === log.id ? (
                                            <>
                                                <Button size="sm" variant="success" className="h-7 px-2" onClick={() => handleSaveEdit(log.id)} disabled={loadingId === log.id}>
                                                    <Check className="w-3 h-3" />
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-7 px-2" onClick={cancelEditing}>
                                                    <X className="w-3 h-3" />
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                {isLatestCheckIn(log) && (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="h-7 px-2 text-rose-600 border-rose-200 hover:bg-rose-50"
                                                        onClick={() => onForceCheckOut(log.employee_id, log.employees?.name || '')}
                                                        disabled={loadingId === log.id}
                                                    >
                                                        Закрыть
                                                    </Button>
                                                )}
                                                <Button size="sm" variant="outline" className="h-7 px-2 text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => startEditing(log)} disabled={loadingId === log.id}>
                                                    <Pencil className="w-3 h-3" />
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-7 px-2 text-gray-500 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200" onClick={() => handleDelete(log.id)} disabled={loadingId === log.id}>
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {logs.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Логов пока нет.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
