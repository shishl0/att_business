'use client'

import { useState, useMemo, DragEvent, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  addEmployee, resetDevice, updateEmployee, deleteEmployee, forceCheckOutAdmin,
  deleteAllLogs, addSchedule, updateSchedule, deleteSchedule, getAdminDashboardData
} from '@/app/actions'
import * as XLSX from 'xlsx'
import { Plus, Download, RefreshCw, SmartphoneNfc, Users, Clock, AlertTriangle, Edit2, Check, X, Trash2, CalendarCheck, ClockAlert, LogOut, Calendar as CalendarIcon, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from 'sonner'

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

type Schedule = {
  id: string
  employee_id: string
  day_of_week: number
  start_time: string
  end_time: string
  employees: { name: string }
}

type Shift = {
  id: string
  employee_id: string
  employee_name: string
  date: string
  check_in_time: string | null
  check_out_time: string | null
  duration_ms: number
  is_overtime: boolean
}

type TabKey = 'employees' | 'schedule' | 'calendar' | 'logs'

function createShift(inLog: Log | null, outLog: Log | null): Shift {
  const baseLog = inLog || outLog!
  const empId = baseLog.employee_id
  const empName = baseLog.employees?.name || 'Неизвестно'

  const inTime = inLog ? new Date(inLog.timestamp) : null
  const outTime = outLog ? new Date(outLog.timestamp) : null

  const refDate = inTime || outTime!

  // Format to standard YYYY-MM-DD for simpler calendar math
  const year = refDate.getFullYear()
  const month = String(refDate.getMonth() + 1).padStart(2, '0')
  const day = String(refDate.getDate()).padStart(2, '0')
  const dateStr = `${year}-${month}-${day}` // ISO-like for grouping

  let duration_ms = 0
  let is_overtime = false

  if (inTime && outTime) {
    duration_ms = outTime.getTime() - inTime.getTime()
    const hours = duration_ms / (1000 * 60 * 60)

    // GMT+5 Offset
    const offsetMs = 5 * 60 * 60 * 1000
    const localEndTime = new Date(outTime.getTime() + offsetMs)
    const endHour = localEndTime.getUTCHours()

    if (hours > 13 || endHour >= 22 || endHour < 9) {
      is_overtime = true
    }
  }

  return {
    id: `shift_${baseLog.id}`,
    employee_id: empId,
    employee_name: empName,
    date: dateStr,
    check_in_time: inLog ? inLog.timestamp : null,
    check_out_time: outLog ? outLog.timestamp : null,
    duration_ms,
    is_overtime
  }
}

function computeShifts(logs: Log[]): Shift[] {
  const reversed = [...logs].reverse()
  const shifts: Shift[] = []
  const openShifts: Record<string, Log> = {}

  reversed.forEach(log => {
    if (log.type === 'check_in') {
      openShifts[log.employee_id] = log
    } else if (log.type === 'check_out') {
      const inLog = openShifts[log.employee_id]
      if (inLog) {
        shifts.push(createShift(inLog, log))
        delete openShifts[log.employee_id]
      } else {
        shifts.push(createShift(null, log))
      }
    }
  })

  // Add remaining open shifts
  Object.values(openShifts).forEach(inLog => {
    shifts.push(createShift(inLog, null))
  })

  return shifts
}

function formatDuration(ms: number) {
  if (ms <= 0) return '-'
  const hrs = Math.floor(ms / (1000 * 60 * 60))
  const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
  return `${hrs} ч ${mins} м`
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  let day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Make Monday = 0
}

const WEEKDAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"]

export default function AdminDashboard({
  initialTab,
  initialEmployees,
  initialLogs,
  initialSchedules
}: {
  initialTab?: TabKey
  initialEmployees: Employee[]
  initialLogs: Log[]
  initialSchedules: Schedule[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const defaultTab = ['employees', 'schedule', 'calendar', 'logs'].includes(initialTab || '') ? initialTab : 'employees'
  const [activeTab, setActiveTabRaw] = useState<TabKey>((defaultTab as TabKey))

  const setActiveTab = (tab: TabKey) => {
    setActiveTabRaw(tab)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const [employees, setEmployees] = useState(initialEmployees)
  const [logs, setLogs] = useState(initialLogs)
  const [schedules, setSchedules] = useState(initialSchedules)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Polling data every 30 seconds
  useEffect(() => {
    const handlePoll = async () => {
      const res = await getAdminDashboardData()
      if (res.success) {
        setEmployees(res.employees || [])
        setLogs(res.logs || [])
        setSchedules(res.schedules || [])
      }
    }
    const interval = setInterval(handlePoll, 30000)
    return () => clearInterval(interval)
  }, [])

  const manualRefresh = async () => {
    setIsRefreshing(true)
    const res = await getAdminDashboardData()
    if (res.success) {
      setEmployees(res.employees || [])
      setLogs(res.logs || [])
      setSchedules(res.schedules || [])
      toast.success('Данные успешно обновлены')
    } else {
      toast.error('Ошибка обновления данных')
    }
    setIsRefreshing(false)
  }

  // Edit employee state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editIsActive, setEditIsActive] = useState(true)

  // Add employee
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date())

  // Schedule drag-n-drop state
  const [draggedEmp, setDraggedEmp] = useState<Employee | null>(null)

  const shifts = useMemo(() => computeShifts(logs), [logs])

  // Group shifts for calendar
  const calendarShifts = useMemo(() => {
    const map: Record<string, Shift[]> = {}
    shifts.forEach(s => {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    })
    return map
  }, [shifts])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setAdding(true)
    const res = await addEmployee(newName)
    if (res.success) {
      setNewName('')
      toast.success('Сотрудник добавлен!')
      manualRefresh()
    } else {
      toast.error('Ошибка: ' + res.error)
    }
    setAdding(false)
  }

  async function handleResetDevice(id: string) {
    if (!confirm('Сбросить привязку устройства?')) return
    const res = await resetDevice(id)
    if (res.success) {
      setEmployees(employees.map(e => e.id === id ? { ...e, device_id: null } : e))
      toast.success('Устройство отвязано')
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  async function handleForceOut(id: string, name: string) {
    if (!confirm(`Вы уверены, что хотите завершить смену за ${name}?`)) return
    const res = await forceCheckOutAdmin(id)
    if (res.success) {
      toast.success(`Смена завершена за ${name}`)
      manualRefresh()
    } else {
      toast.error('Ошибка: ' + res.error)
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
      toast.success('Изменения сохранены')
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Удалить сотрудника "${name}"? Все логи исчезнут.`)) return
    const res = await deleteEmployee(id)
    if (res.success) {
      setEmployees(employees.filter(e => e.id !== id))
      toast.success(`Сотрудник ${name} удален`)
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  async function handleClearLogs() {
    const code = prompt('Чтобы удалить ВСЕ логи, введите "ОЧИСТИТЬ" (без кавычек). Это действие необратимо!')
    if (code !== 'ОЧИСТИТЬ') return
    const res = await deleteAllLogs()
    if (res.success) {
      toast.success('Логи полностью очищены')
      manualRefresh()
    } else {
      toast.error('Ошибка удаления логов: ' + res.error)
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
    toast.success('Файл загружен')
  }

  function isEmployeeCheckedIn(empId: string) {
    const empLog = logs.find(l => l.employee_id === empId)
    return empLog?.type === 'check_in'
  }

  // ---- Schedule Handlers ----
  const handleDragStart = (e: DragEvent, emp: Employee) => {
    setDraggedEmp(emp)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDropToDay = async (e: DragEvent, dayIndex: number) => {
    e.preventDefault()
    if (!draggedEmp) return

    // Prevent Duplicates
    const alreadyExists = schedules.some(s => s.employee_id === draggedEmp.id && s.day_of_week === dayIndex + 1)
    if (alreadyExists) {
      toast.error(`${draggedEmp.name} уже назначен(а) на ${WEEKDAYS[dayIndex]}`)
      return
    }

    const start = prompt(`Укажите время начала (HH:MM) для ${draggedEmp.name}:`, "09:00")
    if (!start) return
    const end = prompt(`Укажите время окончания (HH:MM) для ${draggedEmp.name}:`, "22:00")
    if (!end) return

    const res = await addSchedule(draggedEmp.id, dayIndex + 1, start, end)
    if (res.success) {
      toast.success(`В расписание добавлен(а) ${draggedEmp.name}`)
      manualRefresh()
    } else {
      toast.error('Ошибка добавления: ' + res.error)
    }
  }

  const handleScheduleEdit = async (sched: Schedule) => {
    const start = prompt(`Изменить начало (${sched.start_time}):`, sched.start_time)
    if (!start) return
    const end = prompt(`Изменить конец (${sched.end_time}):`, sched.end_time)
    if (!end) return
    const res = await updateSchedule(sched.id, start, end)
    if (res.success) {
      setSchedules(schedules.map(s => s.id === sched.id ? { ...s, start_time: start, end_time: end } : s))
      toast.success('Расписание обновлено')
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleScheduleDelete = async (id: string) => {
    if (!confirm('Удалить из расписания?')) return
    const res = await deleteSchedule(id)
    if (res.success) {
      setSchedules(schedules.filter(s => s.id !== id))
      toast.success('Расписание удалено')
    } else {
      toast.error('Ошибка удаления: ' + res.error)
    }
  }

  // Calendar render tools
  const renderCalendarCell = (year: number, month: number, day: number) => {
    if (day === 0) return <div className="min-h-[140px] bg-gray-50/50 border border-gray-100 rounded-lg p-2 opacity-50"></div>

    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayShifts = calendarShifts[dStr] || []

    return (
      <div className="min-h-[140px] border border-gray-200 rounded-xl bg-white p-3 hover:shadow-md transition-shadow relative group">
        <span className="text-sm font-bold text-gray-400 absolute top-3 right-3">{day}</span>
        <div className="mt-6 flex flex-col gap-2">
          {dayShifts.map((s, i) => (
            <div key={i} className={`p-2 rounded-lg text-xs font-semibold shadow-sm border ${s.is_overtime ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-blue-50 border-blue-100 text-blue-900'} flex flex-col gap-1`}>
              <div className="flex justify-between items-center gap-2">
                <span className="truncate" title={s.employee_name}>{s.employee_name}</span>
                {s.is_overtime && <ClockAlert className="w-3.5 h-3.5 text-orange-600 shrink-0" />}
              </div>
              <div className="text-[10px] opacity-70 flex justify-between">
                <span>{s.check_in_time ? new Date(s.check_in_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                <span> - </span>
                <span>{s.check_out_time ? new Date(s.check_out_time).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : 'Сейчас'}</span>
              </div>
            </div>
          ))}
          {dayShifts.length === 0 && <span className="text-xs text-gray-300 mx-auto mt-2">Нет записей</span>}
        </div>
      </div>
    )
  }

  const renderMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const daysInMonth = getDaysInMonth(year, month)
    const firstDay = getFirstDayOfMonth(year, month)

    const calendarDays = Array(firstDay).fill(0).concat(
      Array.from({ length: daysInMonth }, (_, i) => i + 1)
    )

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
          <Button variant="outline" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>
            Пред. месяц
          </Button>
          <h3 className="font-extrabold text-xl text-gray-800 capitalize">
            {currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
          </h3>
          <Button variant="outline" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>
            След. месяц
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-3">
          {WEEKDAYS.map(day => (
            <div key={day} className="text-center font-bold text-gray-500 text-sm py-2">
              {day}
            </div>
          ))}
          {calendarDays.map((day, i) => (
            <div key={i}>
              {renderCalendarCell(year, month, day)}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Панель Управления</h1>
          </div>
          <div className="flex flex-wrap bg-gray-100/80 p-1.5 rounded-xl w-full xl:w-auto shadow-inner gap-1">
            <Button
              variant={activeTab === 'employees' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('employees')}
              className={`flex-1 md:flex-none gap-2 px-6 shadow-none transition-all ${activeTab === 'employees' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                }`}
            >
              <Users className="w-4 h-4" />
              Сотрудники
            </Button>
            <Button
              variant={activeTab === 'schedule' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('schedule')}
              className={`flex-1 md:flex-none gap-2 px-6 shadow-none transition-all ${activeTab === 'schedule' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                }`}
            >
              <CalendarIcon className="w-4 h-4" />
              Расписание (План)
            </Button>
            <Button
              variant={activeTab === 'calendar' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 md:flex-none gap-2 px-6 shadow-none transition-all ${activeTab === 'calendar' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                }`}
            >
              <CalendarCheck className="w-4 h-4" />
              Календарь (Факт)
            </Button>
            <Button
              variant={activeTab === 'logs' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('logs')}
              className={`flex-1 md:flex-none gap-2 px-6 shadow-none transition-all ${activeTab === 'logs' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                }`}
            >
              <Clock className="w-4 h-4" />
              Логи
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 shadow-black/5 min-h-[700px]">

          {/* Employees Tab */}
          {activeTab === 'employees' && (
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
                      <th className="px-6 py-4 text-center">На смене?</th>
                      <th className="px-6 py-4 text-right border-l border-gray-100">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {employees.map(emp => {
                      const isEditing = editingId === emp.id
                      const isCheckedIn = isEmployeeCheckedIn(emp.id)
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
                            {isCheckedIn ? <span className="inline-flex gap-2 px-4 py-1.5 bg-green-100 text-green-800 rounded-full text-sm font-bold border border-green-200"><Clock className="w-4 h-4" /> Работает</span> : <span className="inline-flex gap-2 px-4 py-1.5 bg-gray-100 text-gray-600 rounded-full text-sm font-bold border border-gray-200"><span className="w-2 h-2 rounded-full bg-gray-400"></span> Нет на месте</span>}
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
                                  {isCheckedIn && <Button size="icon" variant="destructive" onClick={() => handleForceOut(emp.id, emp.name)} className="mr-4"><LogOut className="w-5 h-5" /></Button>}
                                  {emp.device_id && <Button size="icon" variant="warning" onClick={() => handleResetDevice(emp.id)}><RefreshCw className="w-5 h-5" /></Button>}
                                  <Button size="icon" variant="default" onClick={() => startEdit(emp)}><Edit2 className="w-5 h-5" /></Button>
                                  <Button size="icon" variant="destructive" onClick={() => handleDelete(emp.id, emp.name)}><Trash2 className="w-5 h-5" /></Button>
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
          )}

          {/* Schedule Planner Tab */}
          {activeTab === 'schedule' && (
            <div className="animate-in fade-in zoom-in-95 duration-200 flex flex-col lg:flex-row gap-6">

              {/* Draggable Employees List */}
              <div className="w-full lg:w-64 bg-gray-50 border border-gray-200 rounded-xl p-4 shrink-0 flex flex-col max-h-[700px]">
                <h3 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200 flex justify-between items-center">
                  <span>Сотрудники</span>
                  <GripVertical className="w-4 h-4 text-gray-400" />
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                  <p className="text-xs text-gray-500 mb-2 leading-relaxed">
                    Перетащите карточку сотрудника в колонку дня недели, чтобы назначить смену.
                  </p>
                  {employees.filter(e => e.is_active).map(emp => (
                    <div
                      key={emp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, emp)}
                      className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-blue-400 hover:shadow-md transition-all flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-sm">
                        {emp.name.charAt(0)}
                      </div>
                      <span className="font-semibold text-gray-800 text-sm truncate">{emp.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Grid */}
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-3">
                {WEEKDAYS.map((day, dIdx) => {
                  const daySchedules = schedules.filter(s => s.day_of_week === dIdx + 1)
                  return (
                    <div
                      key={day}
                      className="bg-gray-50/50 border border-gray-200 rounded-xl flex flex-col overflow-hidden transition-colors data-[drop=true]:bg-blue-50 data-[drop=true]:border-blue-300"
                      onDragOver={e => { e.preventDefault(); e.currentTarget.setAttribute('data-drop', 'true') }}
                      onDragLeave={e => e.currentTarget.removeAttribute('data-drop')}
                      onDrop={e => { e.currentTarget.removeAttribute('data-drop'); handleDropToDay(e, dIdx) }}
                    >
                      <div className="bg-white border-b border-gray-200 p-3 text-center font-bold text-gray-700">
                        {day}
                      </div>
                      <div className="p-3 flex-1 flex flex-col gap-2 min-h-[150px]">
                        {daySchedules.map(sched => (
                          <div key={sched.id} className="bg-white border text-left border-gray-200 rounded-lg p-3 shadow-sm group">
                            <div className="font-bold text-sm text-gray-900 truncate mb-2">{sched.employees?.name}</div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">
                                {sched.start_time.substring(0, 5)} - {sched.end_time.substring(0, 5)}
                              </span>
                            </div>
                            <div className="mt-3 flex gap-2">
                              {/* Edit & Delete directly inside the schedule card */}
                              <Button size="sm" variant="outline" className="h-7 w-full text-xs" onClick={() => handleScheduleEdit(sched)}>
                                <Edit2 className="w-3 h-3 mr-1" />
                              </Button>
                              <Button size="sm" variant="destructive" className="h-7 w-full text-xs" onClick={() => handleScheduleDelete(sched.id)}>
                                <X className="w-3 h-3 mr-1" />
                              </Button>
                            </div>
                          </div>
                        ))}
                        {daySchedules.length === 0 && (
                          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl m-1">
                            <span className="text-xs font-semibold text-gray-400 rotate-0 md:-rotate-90 xl:rotate-0 px-4 text-center">Перетащите сюда</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

            </div>
          )}

          {/* Calendar Tab (FACT) */}
          {activeTab === 'calendar' && (
            <div className="animate-in fade-in zoom-in-95 duration-200">
              {renderMonth()}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-900 px-1">Журнал событий (Факт)</h2>
                <div className="flex gap-3">
                  <Button onClick={manualRefresh} variant="outline" className="gap-2 text-sm px-4" disabled={isRefreshing}>
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Обновить
                  </Button>
                  <Button onClick={exportToExcel} variant="success" className="gap-2 text-sm px-4">
                    <Download className="w-4 h-4" /> Excel
                  </Button>
                  <Button onClick={handleClearLogs} variant="destructive" className="gap-2 text-sm px-4">
                    <Trash2 className="w-4 h-4" /> Очистить логи
                  </Button>
                </div>
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
                        <td className="px-6 py-4 font-semibold text-gray-900 whitespace-nowrap text-base">{log.employees?.name || 'Удаленный сотрудник'}</td>
                        <td className="px-6 py-4">{log.type === 'check_in' ? <span className="inline-flex px-4 py-1.5 bg-emerald-100 text-emerald-800 rounded-lg text-sm font-bold border border-emerald-200">🟢 Пришел</span> : <span className="inline-flex px-4 py-1.5 bg-rose-100 text-rose-800 rounded-lg text-sm font-bold border border-rose-200">🔴 Ушел</span>}</td>
                        <td className="px-6 py-4 text-gray-700 whitespace-nowrap font-medium text-[15px]">{new Date(log.timestamp).toLocaleString('ru-RU')}</td>
                        <td className="px-6 py-4 text-gray-500 font-mono text-[13px]">{log.ip_address}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">Логов пока нет.</td></tr>}
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
