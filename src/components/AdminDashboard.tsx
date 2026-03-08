'use client'

import { useState, useMemo, DragEvent, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import {
  addEmployee, resetDevice, updateEmployee, deleteEmployee, forceCheckOutAdmin,
  deleteAllLogs, addSchedule, updateSchedule, deleteSchedule, getAdminDashboardData,
  manualMarkAttendance, processShiftAccrual, withdrawSalary, updateSetting, processDebtOrAdvance
} from '@/app/actions'
import * as XLSX from 'xlsx'
import { Plus, Download, RefreshCw, SmartphoneNfc, Users, Clock, AlertTriangle, Edit2, Check, X, Trash2, CalendarCheck, ClockAlert, LogOut, Calendar as CalendarIcon, GripVertical, Wallet, Landmark, HandCoins, Settings } from 'lucide-react'
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
  balance: number
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
  shift_salary: number
  employees: { name: string }
}

type Transaction = {
  id: string
  employee_id: string
  amount: number
  type: 'accrual' | 'withdrawal'
  timestamp: string
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
  is_late: boolean
}

type TabKey = 'employees' | 'schedule' | 'calendar' | 'logs' | 'finances' | 'settings'

function createShift(inLog: Log | null, outLog: Log | null, schedulesForDay: Schedule[] = []): Shift {
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
  let is_late = false

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

  if (inTime && schedulesForDay.length > 0) {
    // Check if they were late based on the first schedule of that day
    const firstSchedule = schedulesForDay.sort((a, b) => a.start_time.localeCompare(b.start_time))[0]
    const [schedHour, schedMin] = firstSchedule.start_time.split(':').map(Number)

    // Convert inTime to local for comparison (roughly)
    const offsetMs = 5 * 60 * 60 * 1000
    const localInTime = new Date(inTime.getTime() + offsetMs)
    const inHour = localInTime.getUTCHours()
    const inMin = localInTime.getUTCMinutes()

    if (inHour > schedHour || (inHour === schedHour && inMin > schedMin + 15)) {
      is_late = true // late by more than 15 mins
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
    is_overtime,
    is_late
  }
}

function computeShifts(logs: Log[], schedules: Schedule[]): Shift[] {
  const reversed = [...logs].reverse()
  const shifts: Shift[] = []
  const openShifts: Record<string, Log> = {}

  reversed.forEach(log => {
    // Find schedules for this employee for this day of week
    const logDate = new Date(log.timestamp)
    const dayOfWeek = logDate.getDay() || 7 // 1-7 (Mon-Sun)
    const empSchedules = schedules.filter(s => s.employee_id === log.employee_id && s.day_of_week === dayOfWeek)

    if (log.type === 'check_in') {
      openShifts[log.employee_id] = log
    } else if (log.type === 'check_out') {
      const inLog = openShifts[log.employee_id]
      if (inLog) {
        shifts.push(createShift(inLog, log, empSchedules))
        delete openShifts[log.employee_id]
      } else {
        shifts.push(createShift(null, log, empSchedules))
      }
    }
  })

  // Add remaining open shifts
  Object.values(openShifts).forEach(inLog => {
    const logDate = new Date(inLog.timestamp)
    const dayOfWeek = logDate.getDay() || 7
    const empSchedules = schedules.filter(s => s.employee_id === inLog.employee_id && s.day_of_week === dayOfWeek)
    shifts.push(createShift(inLog, null, empSchedules))
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
  initialSchedules,
  initialTransactions,
  initialAllowedIps
}: {
  initialTab?: TabKey
  initialEmployees: Employee[]
  initialLogs: Log[]
  initialSchedules: Schedule[]
  initialTransactions?: Transaction[]
  initialAllowedIps?: string
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
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions || [])
  const [allowedIps, setAllowedIps] = useState(initialAllowedIps || '.*')
  const [ipInput, setIpInput] = useState(initialAllowedIps || '.*')
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Polling data every 30 seconds
  useEffect(() => {
    const handlePoll = async () => {
      const res = await getAdminDashboardData()
      if (res.success) {
        setEmployees(res.employees || [])
        setLogs(res.logs || [])
        setSchedules(res.schedules || [])
        setTransactions(res.transactions || [])
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
      setTransactions(res.transactions || [])
      if (res.allowed_ips) {
        setAllowedIps(res.allowed_ips)
        setIpInput(res.allowed_ips)
      }
      toast.success('Данные успешно обновлены')
    } else {
      toast.error('Ошибка обновления данных')
    }
    setIsRefreshing(false)
  }

  const handleSaveSettings = async () => {
    setIsRefreshing(true)
    const res = await updateSetting('allowed_ips', ipInput)
    if (res.success) {
      setAllowedIps(ipInput)
      toast.success('Настройки сохранены')
    } else {
      toast.error('Ошибка сохранения: ' + res.error)
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
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null)
  const [scheduleViewMode, setScheduleViewMode] = useState<'week' | 'day'>('week')
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0)

  // Finance Modals
  const [financeModalOpen, setFinanceModalOpen] = useState(false)
  const [selectedFinanceEmp, setSelectedFinanceEmp] = useState<Employee | null>(null)
  const [withdrawAmount, setWithdrawAmount] = useState('')

  // Schedule Modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleDayTarget, setScheduleDayTarget] = useState<number>(1)
  const [scheduleTargetEmp, setScheduleTargetEmp] = useState<Employee | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null)
  const [schedStartInput, setSchedStartInput] = useState('09:00')
  const [schedEndInput, setSchedEndInput] = useState('22:00')
  const [schedSalaryInput, setSchedSalaryInput] = useState('5000')

  // Manual Accrual Modal
  const [accrualModalOpen, setAccrualModalOpen] = useState(false)
  const [accrualEmp, setAccrualEmp] = useState<Employee | null>(null)
  const [accrualAmountInput, setAccrualAmountInput] = useState('')

  // Debt Modal
  const [debtModalOpen, setDebtModalOpen] = useState(false)
  const [debtEmp, setDebtEmp] = useState<Employee | null>(null)
  const [debtAmountInput, setDebtAmountInput] = useState('')
  const [debtCommentInput, setDebtCommentInput] = useState('Аванс / Долг')

  // Manual Check-in Modal
  const [manualCheckModalOpen, setManualCheckModalOpen] = useState(false)
  const [manualCheckEmp, setManualCheckEmp] = useState<Employee | null>(null)
  const [manualCheckType, setManualCheckType] = useState<'check_in' | 'check_out'>('check_in')

  const shifts = useMemo(() => computeShifts(logs, schedules), [logs, schedules])

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

  const handleDropToDay = async (e: DragEvent | null, dayIndex: number, empOverride?: Employee) => {
    if (e) e.preventDefault()
    const emp = empOverride || draggedEmp
    if (!emp) return

    // Prevent Duplicates
    const alreadyExists = schedules.some(s => s.employee_id === emp.id && s.day_of_week === dayIndex + 1)
    if (alreadyExists) {
      toast.error(`${emp.name} уже назначен(а) на ${WEEKDAYS[dayIndex]}`)
      return
    }

    const start = "09:00"
    const end = "22:00"
    const salary = "5000"

    setScheduleTargetEmp(emp)
    setScheduleDayTarget(dayIndex + 1)
    setSchedStartInput(start)
    setSchedEndInput(end)
    setSchedSalaryInput(salary)
    setEditingScheduleId(null)
    setScheduleModalOpen(true)
  }

  const handleScheduleEdit = (sched: Schedule) => {
    setEditingScheduleId(sched.id)
    setSchedStartInput(sched.start_time.substring(0, 5))
    setSchedEndInput(sched.end_time.substring(0, 5))
    setSchedSalaryInput(sched.shift_salary?.toString() || '0')
    const emp = employees.find(e => e.id === sched.employee_id)
    setScheduleTargetEmp(emp || null)
    setScheduleDayTarget(sched.day_of_week)
    setScheduleModalOpen(true)
  }

  const handleSaveSchedule = async () => {
    if (!scheduleTargetEmp) return
    const salary = Number(schedSalaryInput) || 0
    if (editingScheduleId) {
      const res = await updateSchedule(editingScheduleId, schedStartInput, schedEndInput, salary)
      if (res.success) {
        setSchedules(schedules.map(s => s.id === editingScheduleId ? { ...s, start_time: schedStartInput, end_time: schedEndInput, shift_salary: salary } : s))
        toast.success('Расписание обновлено')
      } else {
        toast.error('Ошибка: ' + res.error)
      }
    } else {
      const res = await addSchedule(scheduleTargetEmp.id, scheduleDayTarget, schedStartInput, schedEndInput, salary)
      if (res.success) {
        toast.success(`В расписание добавлен(а) ${scheduleTargetEmp.name}`)
        manualRefresh()
      } else {
        toast.error('Ошибка добавления: ' + res.error)
      }
    }
    setScheduleModalOpen(false)
    setEditingScheduleId(null)
    setScheduleTargetEmp(null)
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

  // Finance Handlers
  const openFinanceModal = (emp: Employee) => {
    setSelectedFinanceEmp(emp)
    setWithdrawAmount('')
    setFinanceModalOpen(true)
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFinanceEmp) return
    const amount = Number(withdrawAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error('Введите корректную сумму')
      return
    }
    const res = await withdrawSalary(selectedFinanceEmp.id, amount)
    if (res.success) {
      toast.success('Средства успешно списаны')
      setEmployees(employees.map(emp => emp.id === selectedFinanceEmp.id ? { ...emp, balance: res.newBalance || 0 } : emp))
      manualRefresh()
      setFinanceModalOpen(false)
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  // Manual Check-in Handlers
  const [manualDatetime, setManualDatetime] = useState(() => {
    const tzOffsetMs = 5 * 60 * 60 * 1000 // GMT+5
    const now = new Date(Date.now() + tzOffsetMs)
    return now.toISOString().slice(0, 16)
  })

  const openManualCheckModal = (emp: Employee, type: 'check_in' | 'check_out') => {
    setManualCheckEmp(emp)
    setManualCheckType(type)
    const tzOffsetMs = 5 * 60 * 60 * 1000
    const now = new Date(Date.now() + tzOffsetMs)
    setManualDatetime(now.toISOString().slice(0, 16))
    setManualCheckModalOpen(true)
  }

  const handleManualCheckSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualCheckEmp || !manualDatetime) return

    // convert local datetime-local back to UTC string for DB
    const localMs = new Date(manualDatetime).getTime()
    const utcMs = localMs - (5 * 60 * 60 * 1000) // subtract GMT+5
    const isoString = new Date(utcMs).toISOString()

    const res = await manualMarkAttendance(manualCheckEmp.id, manualCheckType, isoString)
    if (res.success) {
      toast.success(`Ручная отметка (${manualCheckType === 'check_in' ? 'Пришел' : 'Ушел'}) добавлена`)
      manualRefresh()
      setManualCheckModalOpen(false)
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const openAccrualModal = (emp: Employee) => {
    setAccrualEmp(emp)

    const tzOffsetMs = 5 * 60 * 60 * 1000 // GMT+5
    const nowLocal = new Date(Date.now() + tzOffsetMs)
    const dayOfWeek = nowLocal.getDay() || 7 // 1 = Mon ... 7 = Sun

    // Check if employee has a schedule today
    const todaySched = schedules.find(s => s.employee_id === emp.id && s.day_of_week === dayOfWeek)

    let defaultSalary = 5000
    if (todaySched && todaySched.shift_salary) {
      defaultSalary = todaySched.shift_salary
    }

    setAccrualAmountInput(defaultSalary.toString())
    setAccrualModalOpen(true)
  }

  const handleAccrualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accrualEmp) return
    const amt = Number(accrualAmountInput)
    if (isNaN(amt) || amt <= 0) {
      toast.error('К начислению должна быть сумма больше 0')
      return
    }
    const res = await processShiftAccrual(accrualEmp.id, amt, 'Ручное начисление / Премия')
    if (res.success) {
      toast.success('Начисление прошло успешно!')
      setAccrualModalOpen(false)
      manualRefresh()
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const openDebtModal = (emp: Employee) => {
    setDebtEmp(emp)
    setDebtAmountInput('')
    setDebtCommentInput('Аванс / Долг')
    setDebtModalOpen(true)
  }

  const handleDebtSubmit = async () => {
    if (!debtEmp) return
    const amt = Number(debtAmountInput)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Введите корректную сумму')
      return
    }
    const res = await processDebtOrAdvance(debtEmp.id, amt, debtCommentInput)
    if (res.success) {
      toast.success('Успешно начислен долг/аванс')
      setDebtModalOpen(false)
      manualRefresh()
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  // Calendar render tools
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month')

  // Auto-switch to week view on mobile
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 1024) {
        setCalendarView('week')
      } else {
        setCalendarView('month')
      }
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const renderCalendarCell = (year: number, month: number, day: number) => {
    if (day === 0) return <div className="min-h-[140px] bg-gray-50/50 border border-gray-100 rounded-lg p-2 opacity-50"></div>

    const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const dayShifts = calendarShifts[dStr] || []

    // Group shifts by employee for this cell
    const groupedShifts: Record<string, Shift[]> = {}
    dayShifts.forEach(s => {
      if (!groupedShifts[s.employee_name]) groupedShifts[s.employee_name] = []
      groupedShifts[s.employee_name].push(s)
    })

    return (
      <div className="min-h-[140px] h-full border border-gray-200 rounded-xl bg-white p-3 hover:shadow-md transition-shadow relative group">
        <span className="text-sm font-bold text-gray-400 absolute top-3 right-3">{day}</span>
        <div className="mt-6 flex flex-col gap-2">
          {Object.entries(groupedShifts).map(([empName, empShifts]) => {
            const hasOvertime = empShifts.some(s => s.is_overtime)
            const hasLate = empShifts.some(s => s.is_late)
            return (
              <div key={empName} className={`p-2 rounded-lg text-xs font-semibold shadow-sm border ${hasOvertime ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-blue-50 border-blue-100 text-blue-900'} flex flex-col gap-1`}>
                <div className="flex justify-between items-center gap-2">
                  <span className="truncate" title={empName}>{empName}</span>
                  <div className="flex gap-1 shrink-0">
                    {hasLate && <span className="bg-rose-500 text-white text-[9px] px-1 rounded uppercase tracking-wider">Опоздал</span>}
                    {hasOvertime && <ClockAlert className="w-3.5 h-3.5 text-orange-600" />}
                  </div>
                </div>
                {empShifts.map((s, i) => {
                  const inT = s.check_in_time ? new Date(s.check_in_time) : null
                  const outT = s.check_out_time ? new Date(s.check_out_time) : null
                  const isNextDay = outT && inT && outT.getDate() !== inT.getDate()

                  return (
                    <div key={i} className="text-[10px] opacity-70 flex justify-between border-t border-black/5 pt-1 mt-1 first:border-0 first:pt-0 first:mt-0">
                      <span>{inT ? inT.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
                      <span> - </span>
                      <span>
                        {outT ? outT.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : 'Сейчас'}
                        {isNextDay && <span className="ml-1 text-[8px] font-bold opacity-80">(след.д)</span>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
          {dayShifts.length === 0 && <span className="text-xs text-gray-300 mx-auto mt-2">Нет записей</span>}
        </div>
      </div>
    )
  }

  const renderMonth = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    if (calendarView === 'month') {
      const daysInMonth = getDaysInMonth(year, month)
      const firstDay = getFirstDayOfMonth(year, month)

      const calendarDays = Array(firstDay).fill(0).concat(
        Array.from({ length: daysInMonth }, (_, i) => i + 1)
      )

      return (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 gap-4">
            <Button variant="outline" onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-full sm:w-auto">
              Пред. месяц
            </Button>
            <h3 className="font-extrabold text-lg md:text-xl text-gray-800 capitalize text-center">
              {currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="secondary" onClick={() => setCalendarView('week')} className="flex-1">5 дней</Button>
              <Button variant="outline" onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="flex-1">
                След. месяц
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {WEEKDAYS.map(day => (
              <div key={day} className="hidden lg:block text-center font-bold text-gray-500 text-sm py-2">
                {day}
              </div>
            ))}
            {calendarDays.map((day, i) => (
              <div key={i} className={day === 0 ? "hidden lg:block" : ""}>
                {renderCalendarCell(year, month, day)}
              </div>
            ))}
          </div>
        </div>
      )
    } else {
      // 5-Day View (Current Date + 2, Current Date - 2)
      const days = []
      for (let i = -2; i <= 2; i++) {
        const d = new Date(currentDate)
        d.setDate(d.getDate() + i)
        days.push(d)
      }

      return (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200 gap-4">
            <Button variant="outline" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() - 5); setCurrentDate(d) }} className="w-full sm:w-auto">
              Назад
            </Button>
            <h3 className="font-extrabold text-lg md:text-xl text-gray-800 capitalize text-center">
              {currentDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="secondary" onClick={() => setCalendarView('month')} className="flex-1 hidden lg:block">Месяц</Button>
              <Button variant="outline" onClick={() => { const d = new Date(currentDate); d.setDate(d.getDate() + 5); setCurrentDate(d) }} className="flex-1">
                Вперед
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {days.map((d, i) => {
              const dayName = d.toLocaleDateString('ru-RU', { weekday: 'short' })
              return (
                <div key={i} className="flex flex-col">
                  <div className="text-center font-bold text-gray-500 text-sm py-2 capitalize">
                    {dayName}, {d.getDate()}
                  </div>
                  {renderCalendarCell(d.getFullYear(), d.getMonth(), d.getDate())}
                </div>
              )
            })}
          </div>
        </div>
      )
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Панель Управления</h1>
          </div>
          <div className="flex overflow-x-auto pb-2 xl:pb-0 no-scrollbar xl:bg-transparent -mx-6 px-6 xl:mx-0 xl:px-0 w-[calc(100%+3rem)] xl:w-auto">
            <div className="flex bg-gray-100/80 p-1.5 rounded-xl shadow-inner gap-1 whitespace-nowrap">
              <Button
                variant={activeTab === 'employees' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('employees')}
                className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'employees' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
              >
                <Users className="w-4 h-4" />
                Сотрудники
              </Button>
              <Button
                variant={activeTab === 'schedule' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('schedule')}
                className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'schedule' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
              >
                <CalendarIcon className="w-4 h-4" />
                Расписание
              </Button>
              <Button
                variant={activeTab === 'calendar' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('calendar')}
                className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'calendar' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
              >
                <CalendarCheck className="w-4 h-4" />
                Календарь
              </Button>
              <Button
                variant={activeTab === 'logs' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('logs')}
                className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'logs' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
              >
                <Clock className="w-4 h-4" />
                Логи
              </Button>
              <Button
                variant={activeTab === 'settings' ? 'default' : 'ghost'}
                onClick={() => setActiveTab('settings')}
                className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'settings' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-900 bg-transparent'
                  }`}
              >
                <Settings className="w-4 h-4" />
                Настройки
              </Button>
            </div>
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
                      <th className="px-6 py-4 text-center">Смена</th>
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
                            <div className="flex flex-col items-center gap-1">
                              <span className="font-extrabold text-blue-900 text-lg">{currentBalance.toLocaleString('ru-RU')} ₸</span>
                              <div className="flex gap-1">
                                <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100" onClick={() => openFinanceModal(emp)}>
                                  <Wallet className="w-3 h-3 mr-1" /> Снять
                                </Button>
                                <Button size="sm" variant="secondary" className="h-7 px-2 text-[11px] font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100" onClick={() => openDebtModal(emp)} title="Аванс или долг">
                                  <HandCoins className="w-3 h-3 mr-1" /> Долг
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
                                  {emp.device_id && <Button size="icon" variant="warning" onClick={() => handleResetDevice(emp.id)} title="Отвязать устройство"><RefreshCw className="w-5 h-5" /></Button>}
                                  <Button size="icon" variant="default" onClick={() => startEdit(emp)} title="Изменить"><Edit2 className="w-5 h-5" /></Button>
                                  <Button size="icon" variant="destructive" onClick={() => handleDelete(emp.id, emp.name)} title="Удалить"><Trash2 className="w-5 h-5" /></Button>
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
                    На десктопе: перетащите карточку. <br />
                    На мобильном: нажмите на сотрудника, затем на день.
                  </p>
                  {employees.filter(e => e.is_active).map(emp => (
                    <div
                      key={emp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, emp)}
                      onClick={() => setSelectedEmpId(selectedEmpId === emp.id ? null : emp.id)}
                      className={`bg-white border rounded-lg p-3 shadow-sm cursor-pointer lg:cursor-grab active:lg:cursor-grabbing transition-all flex items-center gap-3 ${selectedEmpId === emp.id ? 'border-blue-600 ring-2 ring-blue-100 bg-blue-50' : 'border-gray-200 hover:border-blue-400'
                        }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${selectedEmpId === emp.id ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800'}`}>
                        {emp.name.charAt(0)}
                      </div>
                      <span className={`font-semibold text-sm truncate ${selectedEmpId === emp.id ? 'text-blue-900' : 'text-gray-800'}`}>{emp.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly/Daily Grid */}
              <div className="flex-1 flex flex-col gap-4">

                {/* View Toggles & Day Selector */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-3 rounded-xl border border-gray-200 shadow-sm gap-4">
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${scheduleViewMode === 'week' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                      onClick={() => setScheduleViewMode('week')}
                    >
                      Неделя
                    </button>
                    <button
                      className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${scheduleViewMode === 'day' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                      onClick={() => setScheduleViewMode('day')}
                    >
                      День
                    </button>
                  </div>

                  {scheduleViewMode === 'day' && (
                    <div className="flex flex-wrap gap-1">
                      {WEEKDAYS.map((day, idx) => (
                        <button
                          key={day}
                          onClick={() => setSelectedDayIdx(idx)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${selectedDayIdx === idx ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {scheduleViewMode === 'week' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-3">
                    {WEEKDAYS.map((day, dIdx) => {
                      const daySchedules = schedules.filter(s => s.day_of_week === dIdx + 1)
                      return (
                        <div
                          key={day}
                          className={`bg-gray-50/50 border border-gray-200 rounded-xl flex flex-col overflow-hidden transition-colors cursor-pointer lg:cursor-default ${selectedEmpId ? 'ring-2 ring-blue-300 border-blue-400 bg-blue-50/50' : ''}`}
                          onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('bg-blue-100') }}
                          onDragLeave={e => e.currentTarget.classList.remove('bg-blue-100')}
                          onDrop={e => { e.currentTarget.classList.remove('bg-blue-100'); handleDropToDay(e, dIdx) }}
                          onClick={() => {
                            if (selectedEmpId) {
                              const emp = employees.find(e => e.id === selectedEmpId)
                              if (emp) handleDropToDay(null, dIdx, emp)
                            }
                          }}
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
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-1">
                    <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
                      <h4 className="font-bold text-gray-800 text-lg">{WEEKDAYS[selectedDayIdx]} <span className="text-sm font-normal text-gray-500 ml-2">(Таймлайн)</span></h4>
                      <p className="text-xs text-gray-500">Нажмите на полосу, чтобы изменить</p>
                    </div>
                    <div className="overflow-x-auto p-4">
                      <div className="min-w-[800px]">
                        {/* Timeline Header (hours) */}
                        <div className="flex border-b border-gray-200 ml-32 pl-4">
                          {Array.from({ length: 24 }).map((_, h) => (
                            <div key={h} className="flex-1 text-[10px] font-bold text-gray-400 text-center py-2 border-l border-gray-100 relative">
                              <span className="-translate-x-1/2 absolute left-0">{h}:00</span>
                            </div>
                          ))}
                        </div>

                        {/* Timeline Body */}
                        <div className="mt-4 space-y-4">
                          {schedules.filter(s => s.day_of_week === selectedDayIdx + 1).length === 0 ? (
                            <div className="text-center py-10 text-gray-400 text-sm font-medium">Нет смен в этот день</div>
                          ) : (
                            schedules.filter(s => s.day_of_week === selectedDayIdx + 1).map(sched => {
                              const [sH, sM] = sched.start_time.split(':').map(Number)
                              const [eH, eM] = sched.end_time.split(':').map(Number)
                              const start = sH + (sM / 60)
                              let end = eH + (eM / 60)
                              let duration = end - start

                              let isOvernight = false
                              if (duration < 0) {
                                duration += 24
                                isOvernight = true
                              }

                              const left = (start / 24) * 100
                              const width = (duration / 24) * 100

                              return (
                                <div key={sched.id} className="flex items-center">
                                  <div className="w-32 truncate text-sm font-bold text-gray-800 pr-2 pb-1">{sched.employees?.name}</div>
                                  <div className="flex-1 relative h-12 bg-gray-50/50 rounded-lg border border-gray-100 flex items-center ml-4">
                                    <div
                                      className="absolute h-8 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-colors rounded shadow-sm flex items-center px-2 text-xs font-bold text-white cursor-pointer z-10 overflow-hidden"
                                      style={{ left: `${left}%`, width: `${width}%` }}
                                      onClick={() => handleScheduleEdit(sched)}
                                      title={`${sched.start_time.substring(0, 5)} - ${sched.end_time.substring(0, 5)} (Нажмите для ред.)`}
                                    >
                                      <span className="truncate drop-shadow-sm">{sched.start_time.substring(0, 5)} - {sched.end_time.substring(0, 5)} {isOvernight && '(след.д)'}</span>
                                    </div>
                                    {/* Grid guides for rows */}
                                    <div className="absolute inset-0 flex pointer-events-none">
                                      {Array.from({ length: 24 }).map((_, h) => (
                                        <div key={h} className="flex-1 border-l border-gray-100/50 h-full"></div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
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
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-bold text-gray-900 px-1">Журнал событий (Факт)</h2>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                  <Button onClick={manualRefresh} variant="outline" className="flex-1 sm:flex-none gap-2 text-sm h-10" disabled={isRefreshing}>
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Обновить
                  </Button>
                  <Button onClick={exportToExcel} variant="success" className="flex-1 sm:flex-none gap-2 text-sm h-10">
                    <Download className="w-4 h-4" /> Excel
                  </Button>
                  <Button onClick={handleClearLogs} variant="destructive" className="w-full sm:w-auto gap-2 text-sm h-10">
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

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-2xl mx-auto">
              <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" />
                Настройки Системы
              </h2>
              <div className="space-y-6">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <label className="block text-sm font-bold text-blue-900 mb-2">Разрешенные IP адреса (RegEx)</label>
                  <p className="text-xs text-blue-700/70 mb-4">Настройте регулярное выражение для проверки IP-адресов сотрудников при отметке. По умолчанию `.*` разрешает все сети.</p>
                  <div className="flex gap-3 items-center">
                    <Input
                      value={ipInput}
                      onChange={e => setIpInput(e.target.value)}
                      placeholder="Например: ^5\.76\.\d{1,3}\.\d{1,3}$"
                      className="font-mono bg-white"
                    />
                    <Button onClick={handleSaveSettings} disabled={isRefreshing} className="flex-none bg-blue-600 hover:bg-blue-700">
                      Сохранить
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Schedule Edit Modal */}
      {scheduleModalOpen && scheduleTargetEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100">
            <h3 className="text-xl font-bold mb-4">{editingScheduleId ? 'Изменить расписание' : 'Добавить в расписание'}</h3>
            <p className="font-semibold text-gray-700 mb-6 pb-4 border-b">Сотрудник: <span className="text-blue-600">{scheduleTargetEmp.name}</span></p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Время начала</label>
                <Input type="time" value={schedStartInput} onChange={e => setSchedStartInput(e.target.value)} className="h-12" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Время окончания</label>
                <Input type="time" value={schedEndInput} onChange={e => setSchedEndInput(e.target.value)} className="h-12" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Зарплата за смену (тг)</label>
                <Input type="number" value={schedSalaryInput} onChange={e => setSchedSalaryInput(e.target.value)} className="h-12" />
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                <Button variant="outline" onClick={() => setScheduleModalOpen(false)}>Отмена</Button>
                <Button variant="success" onClick={handleSaveSchedule}>Сохранить</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Finance Withdraw Modal */}
      {financeModalOpen && selectedFinanceEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-bold flex items-center gap-2"><Wallet className="text-blue-600" /> Снятие средств</h3>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 rounded-full" onClick={() => setFinanceModalOpen(false)}><X className="w-4 h-4" /></Button>
            </div>

            <div className="overflow-y-auto pr-2">
              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100 mb-6 shrink-0">
                <p className="text-sm text-blue-800 font-medium">Текущий депозит</p>
                <h4 className="text-3xl font-extrabold text-blue-900 mt-1">{selectedFinanceEmp.balance?.toLocaleString('ru-RU')} ₸</h4>
                <p className="text-sm text-blue-600/70 mt-1">{selectedFinanceEmp.name}</p>
              </div>

              <form onSubmit={handleWithdraw} className="shrink-0">
                <div className="space-y-2 mb-6">
                  <label className="text-sm font-bold text-gray-700">Сумма к выдаче</label>
                  <div className="relative">
                    <Input type="number" required max={selectedFinanceEmp.balance || 0} placeholder="Например, 5000" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} className="pl-4 pr-12 h-14 text-lg font-semibold" autoFocus />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₸</span>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                  <Button type="button" variant="outline" className="h-11" onClick={() => setFinanceModalOpen(false)}>Отмена</Button>
                  <Button type="submit" variant="success" className="h-11 shadow-sm"><Wallet className="w-4 h-4 mr-2" /> Снять</Button>
                </div>
              </form>

              {/* Mini internal history */}
              <div className="mt-8 shrink-0">
                <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Последние операции (5)</h5>
                <div className="space-y-2">
                  {transactions.filter(t => t.employee_id === selectedFinanceEmp.id).slice(0, 5).map(tx => (
                    <div key={tx.id} className="flex justify-between items-center text-sm py-2 border-b border-gray-50 last:border-0">
                      <span className="text-gray-500 font-medium">{new Date(tx.timestamp).toLocaleDateString('ru')}</span>
                      <span className={`font-bold ${tx.type === 'accrual' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {tx.type === 'accrual' ? '+' : '-'}{tx.amount.toLocaleString()} ₸
                      </span>
                    </div>
                  ))}
                  {transactions.filter(t => t.employee_id === selectedFinanceEmp.id).length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-2">Нет записей</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debt / Advance Modal */}
      {debtModalOpen && debtEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold flex items-center gap-2"><HandCoins className="text-rose-600" /> Начислить долг / аванс</h3>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 rounded-full" onClick={() => setDebtModalOpen(false)}><X className="w-4 h-4" /></Button>
            </div>

            <div className="bg-rose-50/50 rounded-xl p-4 border border-rose-100 mb-6">
              <p className="text-sm text-rose-800 font-medium">Сотрудник</p>
              <h4 className="text-xl font-extrabold text-rose-900 mt-1">{debtEmp.name}</h4>
              <p className="text-sm text-rose-600/70 mt-1">Текущий баланс: {debtEmp.balance?.toLocaleString('ru-RU')} ₸</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Сумма (тг)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-gray-400 font-bold">₸</span>
                  <Input type="number" value={debtAmountInput} onChange={e => setDebtAmountInput(e.target.value)} className="pl-10 h-14 text-lg font-bold" placeholder="Например: 2000" />
                </div>
                <p className="text-xs text-gray-500 mt-1">* Эта сумма будет вычтена из депозита (баланса) сотрудника.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-2">Комментарий</label>
                <Input type="text" value={debtCommentInput} onChange={e => setDebtCommentInput(e.target.value)} className="h-14" placeholder="Например: Взял в долг на проезд" />
              </div>
            </div>

            <Button className="w-full h-14 mt-6 text-lg font-bold bg-rose-600 hover:bg-rose-700 text-white" onClick={handleDebtSubmit}>Подтвердить долг/аванс</Button>
          </div>
        </div>
      )}

      {/* Manual Check-in/out Modal */}
      {manualCheckModalOpen && manualCheckEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-gray-100">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <ClockAlert className={manualCheckType === 'check_in' ? 'text-emerald-500' : 'text-rose-500'} />
              Ручная отметка
            </h3>
            <p className="font-semibold text-gray-700 mb-6 pb-4 border-b">Сотрудник: <span className="text-blue-600">{manualCheckEmp.name}</span></p>

            <form onSubmit={handleManualCheckSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Тип отметки</label>
                <div className={`p-3 rounded-lg border font-bold text-center ${manualCheckType === 'check_in' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'}`}>
                  {manualCheckType === 'check_in' ? '🟢 Пришел' : '🔴 Ушел'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-600 mb-1">Дата и время</label>
                <Input type="datetime-local" required value={manualDatetime} onChange={e => setManualDatetime(e.target.value)} className="h-12" />
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setManualCheckModalOpen(false)}>Отмена</Button>
                <Button type="submit" variant={manualCheckType === 'check_in' ? 'success' : 'destructive'}>Подтвердить</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Accrual Modal */}
      {accrualModalOpen && accrualEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 border border-gray-100">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Landmark className="text-emerald-500 w-6 h-6" />
              Начисление зарплаты
            </h3>
            <p className="font-semibold text-gray-700 mb-6 pb-4 border-b">Сотрудник: <span className="text-blue-600">{accrualEmp.name}</span></p>

            <form onSubmit={handleAccrualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700">Сумма зачисления (₸)</label>
                <div className="relative mt-2">
                  <Input type="number" required placeholder="Например, 5000" min="0" step="10" value={accrualAmountInput} onChange={e => setAccrualAmountInput(e.target.value)} className="pl-4 pr-12 h-14 text-lg font-semibold border-emerald-200 focus-visible:ring-emerald-500" autoFocus />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₸</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">Сумма автоматически подтянута из расписания на сегодня (если есть).</p>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setAccrualModalOpen(false)}>Отмена</Button>
                <Button type="submit" variant="success">Зачислить</Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}
