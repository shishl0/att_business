'use client'

import { useState } from 'react'
import { Plus, RefreshCw, SmartphoneNfc, AlertTriangle, Clock, Wallet, HandCoins, Check, X, Landmark, Edit2, Trash2, History, MoreVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Employee, Transaction, Log } from '@/types'

type EmployeesTabProps = {
    employees: Employee[]
    logs: Log[]
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
    logs,
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

    const getArrivalInfo = (empId: string) => {
        const today = new Date().toISOString().split('T')[0]
        const todayLogs = logs.filter(l => l.employee_id === empId && l.timestamp.startsWith(today))
        const checkIn = todayLogs.find(l => l.type === 'check_in')
        if (!checkIn) return null
        return new Date(checkIn.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-blue-50/50 p-4 sm:p-6 rounded-xl border border-blue-100">
                <h2 className="text-base sm:text-lg font-bold text-blue-900 flex items-center gap-2 mb-4">
                    <Plus className="w-5 h-5 text-blue-600" />
                    Добавить нового сотрудника
                </h2>
                <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                    <Input type="text" placeholder="ФИО сотрудника" required value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1 bg-white border-blue-200 focus-visible:ring-blue-500 placeholder:text-blue-300 h-10 sm:h-12 text-sm sm:text-base" />
                    <Button type="submit" disabled={adding || !newName.trim()} className="h-10 sm:h-12 px-6 sm:px-8 shadow-md shadow-blue-600/20 text-sm sm:text-base min-w-[120px]">
                        {adding ? <RefreshCw className="w-4 h-4 sm:w-5 h-5 animate-spin" /> : 'Добавить'}
                    </Button>
                </form>
            </div>

            {/* Mobile View - Brief */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
                {employees.map(emp => {
                    const isEditing = editingId === emp.id
                    const isCheckedIn = isEmployeeCheckedIn(emp.id)
                    const currentBalance = emp.balance || 0
                    const arrivalTime = getArrivalInfo(emp.id)
                    const latePenalties = transactions.filter(t => t.employee_id === emp.id && t.type === 'withdrawal' && t.source === 'system' && t.comment?.includes('Штраф за опоздание'))

                    return (
                        <div key={emp.id} className={`bg-white p-3 rounded-xl border border-gray-200 shadow-sm ${emp.is_active === false ? 'opacity-60' : ''}`}>
                            <div className="flex justify-between items-center gap-2">
                                <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                        <Input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm" autoFocus />
                                    ) : (
                                        <h3 className="font-bold text-gray-900 text-sm truncate">{emp.name}</h3>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                        {isCheckedIn ? (
                                            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                                <Clock className="w-3 h-3" /> {arrivalTime || 'Работает'}
                                            </span>
                                        ) : (
                                            <span className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
                                                <X className="w-3 h-3" /> {arrivalTime ? `был в ${arrivalTime}` : 'Нет'}
                                            </span>
                                        )}
                                        <span className={`text-[11px] font-bold ${latePenalties.length > 0 ? 'text-rose-600' : 'text-gray-400'}`}>
                                            • {latePenalties.length} штр.
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <div>
                                        <div className="text-sm font-black text-blue-900">{currentBalance.toLocaleString('ru-RU')} ₸</div>
                                    </div>
                                    
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400"><MoreVertical className="w-4 h-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-48 font-bold">
                                            <DropdownMenuItem onClick={() => openManualCheckModal(emp, isCheckedIn ? 'check_out' : 'check_in')}>
                                                <Clock className="w-4 h-4 mr-2" /> {isCheckedIn ? 'Завершить смену' : 'Начать смену'}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem onClick={() => openFinanceModal(emp)}>
                                                <Wallet className="w-4 h-4 mr-2 text-blue-600" /> Снять средства
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openDebtModal(emp)}>
                                                <HandCoins className="w-4 h-4 mr-2 text-rose-600" /> Выдать аванс
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openAccrualModal(emp)}>
                                                <Landmark className="w-4 h-4 mr-2 text-emerald-600" /> Зачислить ЗП
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => openTransactionHistoryModal(emp)}>
                                                <History className="w-4 h-4 mr-2" /> История транзакций
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            {isEditing ? (
                                                <>
                                                    <DropdownMenuItem onClick={() => handleSaveEdit(emp.id)} className="text-emerald-600">
                                                        <Check className="w-4 h-4 mr-2" /> Сохранить
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={cancelEdit}>
                                                        <X className="w-4 h-4 mr-2" /> Отмена
                                                    </DropdownMenuItem>
                                                </>
                                            ) : (
                                                <>
                                                    <DropdownMenuItem onClick={() => startEdit(emp)}>
                                                        <Edit2 className="w-4 h-4 mr-2" /> Редактировать
                                                    </DropdownMenuItem>
                                                    {emp.device_id && (
                                                        <DropdownMenuItem onClick={() => onResetDevice(emp.id)} className="text-orange-600">
                                                            <RefreshCw className="w-4 h-4 mr-2" /> Отвязать устройство
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem onClick={() => onDelete(emp.id, emp.name)} className="text-rose-600">
                                                        <Trash2 className="w-4 h-4 mr-2" /> Удалить
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Desktop View - Compact Table */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-xs sm:text-sm text-left border-collapse">
                    <thead className="bg-gray-50 text-gray-500 font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-3 py-3">Сотрудник</th>
                            <th className="px-3 py-3 text-center">Статус</th>
                            <th className="px-3 py-3 text-center">Устройство</th>
                            <th className="px-3 py-3 text-center">Смена</th>
                            <th className="px-3 py-3 text-center">Штрафы</th>
                            <th className="px-3 py-3 text-center">Баланс</th>
                            <th className="px-3 py-3 text-right">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {employees.map(emp => {
                            const isEditing = editingId === emp.id
                            const isCheckedIn = isEmployeeCheckedIn(emp.id)
                            const currentBalance = emp.balance || 0
                            const arrivalTime = getArrivalInfo(emp.id)

                            return (
                                <tr key={emp.id} className={`hover:bg-blue-50/30 transition-colors ${emp.is_active === false ? 'opacity-50' : ''}`}>
                                    <td className="px-3 py-2.5 font-bold text-gray-900 border-r border-gray-50">
                                        {isEditing ? (
                                            <Input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-xs min-w-[120px]" autoFocus />
                                        ) : (
                                            <div className="flex flex-col">
                                                <span className="text-sm truncate max-w-[150px]">{emp.name}</span>
                                                <span className="text-[10px] text-gray-400 font-medium">#{emp.id.substring(0, 8)}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {isEditing ? (
                                            <Select value={editIsActive ? 'true' : 'false'} onValueChange={v => setEditIsActive(v === 'true')}>
                                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Статус" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="true">Активен</SelectItem>
                                                    <SelectItem value="false">Архив</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${emp.is_active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>
                                                {emp.is_active !== false ? 'Активен' : 'Архив'}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        {emp.device_id ? (
                                            <div className="flex flex-col items-center gap-0.5">
                                                <SmartphoneNfc className="w-3.5 h-3.5 text-sky-600" />
                                                <span className="text-[9px] text-sky-700 font-bold uppercase tracking-tighter">Ok</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-0.5 opacity-40">
                                                <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                                                <span className="text-[9px] text-orange-700 font-bold uppercase tracking-tighter">Нет</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <div className="flex flex-col items-center">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className={`h-7 px-2 text-[10px] font-black border-2 rounded-lg ${isCheckedIn ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                                onClick={() => openManualCheckModal(emp, isCheckedIn ? 'check_out' : 'check_in')}
                                            >
                                                {isCheckedIn ? 'РАБОТАЕТ' : 'УШЕЛ'}
                                            </Button>
                                            {arrivalTime && (
                                                <span className="text-[10px] text-blue-600 font-bold mt-0.5">{arrivalTime}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-3 py-2.5 text-center font-black text-rose-600">
                                        {transactions.filter(t => t.employee_id === emp.id && t.type === 'withdrawal' && t.source === 'system' && t.comment?.includes('Штраф')).length}
                                    </td>
                                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                        <div className="text-sm font-black text-blue-900">{currentBalance.toLocaleString('ru-RU')} ₸</div>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        <div className="flex items-center justify-end gap-1">
                                            {isEditing ? (
                                                <>
                                                    <Button size="icon" variant="success" className="h-7 w-7" onClick={() => handleSaveEdit(emp.id)}><Check className="w-4 h-4" /></Button>
                                                    <Button size="icon" variant="secondary" className="h-7 w-7" onClick={cancelEdit}><X className="w-4 h-4" /></Button>
                                                </>
                                            ) : (
                                                <>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-blue-600 hover:bg-blue-50" onClick={() => openFinanceModal(emp)} title="Списать"><Wallet className="w-4 h-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-600 hover:bg-rose-50" onClick={() => openDebtModal(emp)} title="Аванс"><HandCoins className="w-4 h-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50" onClick={() => openAccrualModal(emp)} title="ЗП"><Landmark className="w-4 h-4" /></Button>
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600" onClick={() => startEdit(emp)}><Edit2 className="w-4 h-4" /></Button>
                                                    
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="w-4 h-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end" className="w-48 font-bold">
                                                            <DropdownMenuItem onClick={() => openTransactionHistoryModal(emp)}>
                                                                <History className="w-4 h-4 mr-2" /> История транзакций
                                                            </DropdownMenuItem>
                                                            {emp.device_id && (
                                                                <DropdownMenuItem onClick={() => onResetDevice(emp.id)} className="text-orange-600">
                                                                    <RefreshCw className="w-4 h-4 mr-2" /> Отвязать устройство
                                                                </DropdownMenuItem>
                                                            )}
                                                            <DropdownMenuItem onClick={() => onDelete(emp.id, emp.name)} className="text-rose-600">
                                                                <Trash2 className="w-4 h-4 mr-2" /> Удалить
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
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
