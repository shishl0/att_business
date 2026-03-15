'use client'

import { useState } from 'react'
import { Plus, RefreshCw, SmartphoneNfc, AlertTriangle, Clock, Wallet, HandCoins, Check, X, Landmark, Edit2, Trash2, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Employee, Transaction } from '@/types'

type EmployeesTabProps = {
    employees: Employee[]
    transactions: Transaction[]
    isEmployeeCheckedIn: (id: string) => boolean
    onAddEmployee: (name: string) => Promise<boolean>
    onSaveEdit: (id: string, name: string, isActive: boolean) => Promise<boolean>
    onDelete: (id: string, name: string) => void
    onResetDevice: (id: string) => void
    openManualCheckModal: (emp: Employee, type: 'check_in' | 'check_out') => void
    openFinanceModal: (emp: Employee) => void
    openDebtModal: (emp: Employee) => void
    openAccrualModal: (emp: Employee) => void
    openTransactionHistoryModal: (emp: Employee) => void
}

export default function EmployeesTab({
    employees,
    transactions,
    isEmployeeCheckedIn,
    onAddEmployee,
    onSaveEdit,
    onDelete,
    onResetDevice,
    openManualCheckModal,
    openFinanceModal,
    openDebtModal,
    openAccrualModal,
    openTransactionHistoryModal
}: EmployeesTabProps) {
    const [newName, setNewName] = useState('')
    const [adding, setAdding] = useState(false)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editIsActive, setEditIsActive] = useState(true)

    const startEdit = (emp: Employee) => {
        setEditingId(emp.id)
        setEditName(emp.name)
        setEditIsActive(emp.is_active)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditName('')
    }

    const handleSaveEdit = async (id: string) => {
        const ok = await onSaveEdit(id, editName, editIsActive)
        if (ok) {
            setEditingId(null)
        }
    }

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        setAdding(true)
        const ok = await onAddEmployee(newName)
        if (ok) {
            setNewName('')
        }
        setAdding(false)
    }

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2 mb-4">
                    <Plus className="w-5 h-5 text-blue-600" />
                    Добавить нового сотрудника
                </h2>
                <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                    <Input type="text" placeholder="ФИО сотрудника" required value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 bg-white border-blue-200 focus-visible:ring-blue-500 placeholder:text-blue-300 h-12 text-base" />
                    <Button type="submit" disabled={adding || !newName.trim()} className="h-12 px-8 shadow-md shadow-blue-600/20 text-base min-w-[140px]">
                        {adding ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Добавить'}
                    </Button>
                </form>
            </div>

            <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium whitespace-nowrap">
                        <tr>
                            <th className="px-6 py-4">Имя</th>
                            <th className="px-6 py-4 text-center">Статус</th>
                            <th className="px-6 py-4 text-center">Устройство</th>
                            <th className="px-6 py-4 text-center">Смена</th>
                            <th className="px-6 py-4 text-center">Штрафы</th>
                            <th className="px-6 py-4 text-center">Баланс (Депозит)</th>
                            <th className="px-6 py-4 text-right border-l border-gray-100">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {employees.map(emp => {
                            const isEditing = editingId === emp.id
                            const isCheckedIn = isEmployeeCheckedIn(emp.id)
                            const currentBalance = emp.balance || 0
                            return (
                                <tr key={emp.id} className={`hover:bg-gray-50/50 transition-colors ${emp.is_active === false ? 'opacity-60' : ''}`}>
                                    <td className="px-6 py-4 font-medium text-gray-900">
                                        {isEditing ? <Input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="min-w-[200px]" autoFocus /> : <span className="text-base">{emp.name}</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {isEditing ? (
                                            <Select value={editIsActive ? 'true' : 'false'} onValueChange={v => setEditIsActive(v === 'true')}>
                                                <SelectTrigger><SelectValue placeholder="Статус" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="true">Активен</SelectItem>
                                                    <SelectItem value="false">В архиве</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <span className={`inline-flex items-center px-4 py-1.5 ${emp.is_active !== false ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-300'} rounded-full text-sm font-bold border shadow-sm`}>
                                                {emp.is_active !== false ? '✅ Активен' : '📁 В архиве'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        {emp.device_id ? <span className="inline-flex gap-2 px-4 py-1.5 bg-sky-100 text-sky-800 rounded-full text-sm font-bold border border-sky-200"><SmartphoneNfc className="w-4 h-4" /> Привязан</span> : <span className="inline-flex gap-2 px-4 py-1.5 bg-orange-100 text-orange-800 rounded-full text-sm font-bold border border-orange-200"><AlertTriangle className="w-4 h-4" /> Не привязан</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <div className="flex flex-col items-center gap-2">
                                            {isCheckedIn ? (
                                                <button
                                                    onClick={() => openManualCheckModal(emp, 'check_out')}
                                                    className="inline-flex gap-2 px-4 py-1.5 bg-green-100/80 hover:bg-green-100 text-green-800 rounded-full text-sm font-bold border border-green-200 cursor-pointer transition-colors"
                                                    title="Нажмите для ручного ухода"
                                                >
                                                    <Clock className="w-4 h-4" /> Работает
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => openManualCheckModal(emp, 'check_in')}
                                                    className="inline-flex gap-2 px-4 py-1.5 bg-gray-100/80 hover:bg-gray-200 text-gray-600 rounded-full text-sm font-bold border border-gray-200 cursor-pointer transition-colors"
                                                    title="Нажмите для ручного прихода"
                                                >
                                                    <span className="w-2 h-2 rounded-full bg-gray-400 mt-1.5"></span> Нет на месте
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        {(() => {
                                            const latePenalties = transactions.filter(t => t.employee_id === emp.id && t.type === 'withdrawal' && t.source === 'system' && t.comment?.includes('Штраф за опоздание'))
                                            return (
                                                <div className="flex flex-col items-center gap-1">
                                                    <span className={`font-bold ${latePenalties.length > 0 ? 'text-rose-600' : 'text-gray-400'}`}>{latePenalties.length} опозданий</span>
                                                </div>
                                            )
                                        })()}
                                    </td>
                                    <td className="px-6 py-4 text-center whitespace-nowrap">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="font-extrabold text-blue-900 text-lg">{currentBalance.toLocaleString('ru-RU')} ₸</span>
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={() => openFinanceModal(emp)}>
                                                    <Wallet className="w-3 h-3 mr-1" /> Снять
                                                </Button>
                                                <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100" onClick={() => openDebtModal(emp)} title="Аванс или долг">
                                                    <HandCoins className="w-3 h-3 mr-1" /> Аванс
                                                </Button>
                                                <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px] font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100" onClick={() => openTransactionHistoryModal(emp)} title="История транзакций">
                                                    <History className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 border-l border-gray-100">
                                        <div className="flex items-center justify-end gap-2">
                                            {isEditing ? (
                                                <>
                                                    <Button size="icon" variant="success" onClick={() => handleSaveEdit(emp.id)}><Check className="w-5 h-5" /></Button>
                                                    <Button size="icon" variant="secondary" onClick={cancelEdit}><X className="w-5 h-5" /></Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button size="icon" variant="outline" className="mr-2 text-emerald-600 border-emerald-200 hover:bg-emerald-50" title="Зачислить ЗП вручную" onClick={() => openAccrualModal(emp)}><Landmark className="w-5 h-5" /></Button>
                                                    {emp.device_id && <Button size="icon" variant="warning" onClick={() => onResetDevice(emp.id)} title="Отвязать устройство"><RefreshCw className="w-5 h-5" /></Button>}
                                                    <Button size="icon" variant="default" onClick={() => startEdit(emp)} title="Изменить"><Edit2 className="w-5 h-5" /></Button>
                                                    <Button size="icon" variant="destructive" onClick={() => onDelete(emp.id, emp.name)} title="Удалить"><Trash2 className="w-5 h-5" /></Button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
