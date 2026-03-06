'use client'

import { useState } from 'react'
import { addEmployee, resetDevice, updateEmployee, deleteEmployee } from '@/app/actions'
import * as XLSX from 'xlsx'
import { Plus, Download, RefreshCw, SmartphoneNfc, Users, Clock, AlertTriangle, Edit2, Check, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type Employee = {
  id: string
  name: string
  device_id: string | null
  is_active: boolean
  created_at: string
}

type Log = {
  id: string
  employee_id: string
  type: string
  timestamp: string
  ip_address: string
  employees: { name: string }
}

export default function AdminDashboard({
  initialEmployees,
  initialLogs
}: {
  initialEmployees: Employee[]
  initialLogs: Log[]
}) {
  const [activeTab, setActiveTab] = useState<'employees' | 'logs'>('employees')

  const [employees, setEmployees] = useState(initialEmployees)
  const [logs] = useState(initialLogs)

  // Edit employee state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

  // Add employee
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const res = await addEmployee(newName)
    if (res.success) {
      setNewName('')
      setAddMsg('Сотрудник добавлен!')
      window.location.reload() // Or mutate client side
    } else {
      setAddMsg('Ошибка добавления: ' + res.error)
    }
    setAdding(false)
  }

  async function handleResetDevice(id: string) {
    if (!confirm('Сбросить привязку устройства? Сотрудник должен будет заново зайти с нового телефона.')) return

    const res = await resetDevice(id)
    if (res.success) {
      setEmployees(employees.map(e => e.id === id ? { ...e, device_id: null } : e))
    } else {
      alert('Ошибка сброса: ' + res.error)
    }
  }

  function startEdit(emp: Employee) {
    setEditingId(emp.id)
    setEditName(emp.name)
    setEditIsActive(emp.is_active !== false)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    const res = await updateEmployee(id, editName, editIsActive)
    if (res.success) {
      setEmployees(employees.map(e => e.id === id ? { ...e, name: editName, is_active: editIsActive } : e))
      setEditingId(null)
    } else {
      alert('Ошибка обновления: ' + res.error)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Вы уверены, что хотите удалить сотрудника "${name}"? Все его логи тоже будут удалены.`)) return
    const res = await deleteEmployee(id)
    if (res.success) {
      setEmployees(employees.filter(e => e.id !== id))
    } else {
      alert('Ошибка удаления: ' + res.error)
    }
  }

  function exportToExcel() {
    const data = logs.map(l => ({
      'Сотрудник': l.employees?.name || 'Неизвестно',
      'Событие': l.type === 'check_in' ? 'Пришел' : 'Ушел',
      'Время': new Date(l.timestamp).toLocaleString('ru-RU'),
      'IP Адрес': l.ip_address || '-'
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Logs')
    XLSX.writeFile(wb, `attendance_${new Date().toLocaleDateString('ru-RU')}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Панель Управления</h1>
          </div>
          <div className="flex bg-gray-100/80 p-1.5 rounded-xl w-full md:w-auto overflow-hidden shadow-inner">
            <Button
              variant={activeTab === 'employees' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('employees')}
              className={`flex-1 md:flex-none gap-2 px-6 shadow-none transition-all ${
                activeTab === 'employees' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
              }`}
            >
              <Users className="w-4 h-4" />
              Сотрудники
            </Button>
            <Button
              variant={activeTab === 'logs' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('logs')}
              className={`flex-1 md:flex-none gap-2 px-6 shadow-none transition-all ${
                activeTab === 'logs' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
              }`}
            >
              <Clock className="w-4 h-4" />
              Логи
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 shadow-black/5 min-h-[600px]">

          {/* Employees Tab */}
          {activeTab === 'employees' && (
            <div className="space-y-8 animate-in fade-in zoom-in-95 duration-200">

              <div className="bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                <h2 className="text-lg font-bold text-blue-900 flex items-center gap-2 mb-4">
                  <Plus className="w-5 h-5 text-blue-600" />
                  Добавить нового сотрудника
                </h2>
                <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="text"
                    placeholder="ФИО сотрудника"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="flex-1 bg-white border-blue-200 focus-visible:ring-blue-500 placeholder:text-blue-300 h-12 text-base"
                  />
                  <Button
                    type="submit"
                    disabled={adding || !newName.trim()}
                    className="h-12 px-8 shadow-md shadow-blue-600/20 text-base min-w-[140px]"
                  >
                    {adding ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Добавить'}
                  </Button>
                </form>
                {addMsg && (
                  <p className="mt-3 text-sm font-medium text-blue-600 bg-white inline-block px-3 py-1 rounded-md border border-blue-100">
                    {addMsg}
                  </p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4 px-1">Список сотрудников</h3>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 font-medium">
                      <tr>
                        <th className="px-6 py-4">Имя</th>
                        <th className="px-6 py-4 text-center">Статус</th>
                        <th className="px-6 py-4 text-center">Устройство</th>
                        <th className="px-6 py-4 text-right border-l border-gray-100">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {employees.map(emp => {
                        const isEditing = editingId === emp.id
                        return (
                        <tr key={emp.id} className={`hover:bg-gray-50/50 transition-colors ${emp.is_active === false ? 'opacity-60' : ''}`}>
                          <td className="px-6 py-4 font-medium text-gray-900">
                            {isEditing ? (
                              <Input 
                                type="text" 
                                value={editName} 
                                onChange={e => setEditName(e.target.value)} 
                                className="min-w-[200px] border-blue-400 focus-visible:ring-blue-100 font-semibold"
                                autoFocus
                              />
                            ) : (
                              <span className="text-base">{emp.name}</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {isEditing ? (
                              <div className="w-[140px] mx-auto text-left">
                                <Select 
                                  value={editIsActive ? 'true' : 'false'} 
                                  onValueChange={v => setEditIsActive(v === 'true')}
                                >
                                  <SelectTrigger className="border-blue-400 focus:ring-blue-100 font-semibold">
                                    <SelectValue placeholder="Статус" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="true">Активен</SelectItem>
                                    <SelectItem value="false">В архиве</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <span className={`inline-flex items-center px-4 py-1.5 ${emp.is_active !== false ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-gray-100 text-gray-600 border border-gray-300'} rounded-full text-sm font-bold shadow-sm`}>
                                {emp.is_active !== false ? '✅ Активен' : '📁 В архиве'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            {emp.device_id ? (
                              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-sky-100 text-sky-800 rounded-full text-sm font-bold border border-sky-200 shadow-sm">
                                <SmartphoneNfc className="w-4 h-4" />
                                Привязан
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-orange-100 text-orange-800 rounded-full text-sm font-bold border border-orange-200 shadow-sm">
                                <AlertTriangle className="w-4 h-4" />
                                Не привязан
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 border-l border-gray-100">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <Button size="icon" variant="success" onClick={() => handleSaveEdit(emp.id)} title="Сохранить">
                                    <Check className="w-5 h-5" />
                                  </Button>
                                  <Button size="icon" variant="secondary" onClick={cancelEdit} title="Отмена" className="border border-gray-200 shadow-sm">
                                    <X className="w-5 h-5" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {emp.device_id && (
                                    <Button size="icon" variant="warning" onClick={() => handleResetDevice(emp.id)} title="Очистить устройство">
                                      <RefreshCw className="w-5 h-5" />
                                    </Button>
                                  )}
                                  <Button size="icon" variant="default" onClick={() => startEdit(emp)} title="Редактировать">
                                    <Edit2 className="w-5 h-5" />
                                  </Button>
                                  <Button size="icon" variant="destructive" onClick={() => handleDelete(emp.id, emp.name)} title="Удалить">
                                    <Trash2 className="w-5 h-5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )})}
                      {employees.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                            Сотрудников пока нет.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-900 px-1">Последние события (до 1000)</h2>
                <Button onClick={exportToExcel} variant="success" className="gap-2 text-base px-5">
                  <Download className="w-4 h-4" />
                  Экспорт Excel
                </Button>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium whitespace-nowrap">
                    <tr>
                      <th className="px-6 py-4">Сотрудник</th>
                      <th className="px-6 py-4">Событие</th>
                      <th className="px-6 py-4">Время</th>
                      <th className="px-6 py-4">IP Адрес</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap text-base">
                          {log.employees?.name || 'Удаленный сотрудник'}
                        </td>
                        <td className="px-6 py-4">
                          {log.type === 'check_in' ? (
                            <span className="inline-flex items-center px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-bold border border-emerald-200 shadow-sm">
                              🟢 Пришел
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-4 py-1.5 bg-rose-100 text-rose-800 rounded-lg text-sm font-bold border border-rose-200 shadow-sm">
                              🔴 Ушел
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap font-medium text-[15px]">
                          {new Date(log.timestamp).toLocaleString('ru-RU')}
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-mono text-[13px] tracking-wide">
                          {log.ip_address}
                        </td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                          Логов пока нет.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
