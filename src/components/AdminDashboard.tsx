'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import * as XLSX from 'xlsx'
import { LogOut, Users, CalendarIcon, CalendarCheck, Clock, Settings, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

// Server Actions
import { addEmployee, resetDevice, updateEmployee, deleteEmployee } from '@/actions/employees'
import { forceCheckOutAdmin, deleteAllLogs, manualMarkAttendance, deleteLog, updateLogTimestamp, autoCloseOpenShifts } from '@/actions/attendance'
import { addSchedule, updateSchedule, deleteSchedule } from '@/actions/schedule'
import { getAdminDashboardData } from '@/actions/admin'
import { processShiftAccrual, withdrawSalary, processDebtOrAdvance } from '@/actions/finance'
import { updateSetting } from '@/actions/settings'

// Types
import { Employee, Log, Schedule, Transaction, Shift, TabKey } from '@/types'

// Utils
import { computeShifts } from '@/lib/utils/shift'

// Tabs
import EmployeesTab from './admin/tabs/EmployeesTab'
import ScheduleTab from './admin/tabs/ScheduleTab'
import CalendarTab from './admin/tabs/CalendarTab'
import LogsTab from './admin/tabs/LogsTab'
import SettingsTab from './admin/tabs/SettingsTab'
import StatisticsTab from './admin/tabs/StatisticsTab'

// Modals
import ScheduleEditModal from './admin/modals/ScheduleEditModal'
import FinanceWithdrawModal from './admin/modals/FinanceWithdrawModal'
import DebtAdvanceModal from './admin/modals/DebtAdvanceModal'
import ManualCheckModal from './admin/modals/ManualCheckModal'
import AccrualModal from './admin/modals/AccrualModal'
import EmployeeTransactionModal from './admin/modals/EmployeeTransactionModal'

export default function AdminDashboard({
  initialTab,
  initialEmployees,
  initialLogs,
  initialSchedules,
  initialTransactions,
  initialAllowedIps,
  initialLateGraceMins,
  initialLatePenaltyKzt
}: {
  initialTab?: TabKey
  initialEmployees: Employee[]
  initialLogs: Log[]
  initialSchedules: Schedule[]
  initialTransactions?: Transaction[]
  initialAllowedIps?: string
  initialLateGraceMins?: string
  initialLatePenaltyKzt?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const defaultTab = ['employees', 'schedule', 'calendar', 'logs', 'settings', 'statistics'].includes(initialTab || '') ? initialTab : 'employees'
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
  const [lateGraceMins, setLateGraceMins] = useState(initialLateGraceMins || '15')
  const [latePenaltyKzt, setLatePenaltyKzt] = useState(initialLatePenaltyKzt || '1000')

  // Top level polling
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

  const manualRefresh = async (silent = false) => {
    const res = await getAdminDashboardData()
    if (res.success) {
      setEmployees(res.employees || [])
      setLogs(res.logs || [])
      setSchedules(res.schedules || [])
      setTransactions(res.transactions || [])
      if (res.allowed_ips) setAllowedIps(res.allowed_ips)
      if (res.late_grace_mins) setLateGraceMins(res.late_grace_mins)
      if (res.late_penalty_kzt) setLatePenaltyKzt(res.late_penalty_kzt)
      if (!silent) toast.success('Данные успешно обновлены')
    } else {
      if (!silent) toast.error('Ошибка обновления данных')
    }
  }

  // --- Derived State ---
  const shifts = useMemo(() => computeShifts(logs, schedules, parseInt(lateGraceMins, 10) || 15), [logs, schedules, lateGraceMins])
  const calendarShifts = useMemo(() => {
    const map: Record<string, Shift[]> = {}
    shifts.forEach(s => {
      if (!map[s.date]) map[s.date] = []
      map[s.date].push(s)
    })
    return map
  }, [shifts])

  // --- Modals State ---
  const [financeModalOpen, setFinanceModalOpen] = useState(false)
  const [financeEmp, setFinanceEmp] = useState<Employee | null>(null)

  const [debtModalOpen, setDebtModalOpen] = useState(false)
  const [debtEmp, setDebtEmp] = useState<Employee | null>(null)

  const [manualCheckModalOpen, setManualCheckModalOpen] = useState(false)
  const [manualCheckEmp, setManualCheckEmp] = useState<Employee | null>(null)
  const [manualCheckType, setManualCheckType] = useState<'check_in' | 'check_out'>('check_in')

  const [accrualModalOpen, setAccrualModalOpen] = useState(false)
  const [accrualEmp, setAccrualEmp] = useState<Employee | null>(null)

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleEmp, setScheduleEmp] = useState<Employee | null>(null)
  const [scheduleDay, setScheduleDay] = useState<number>(1)
  const [scheduleInitStart, setScheduleInitStart] = useState('09:00')
  const [scheduleInitEnd, setScheduleInitEnd] = useState('22:00')
  const [scheduleInitSalary, setScheduleInitSalary] = useState('5000')
  const [scheduleEditingId, setScheduleEditingId] = useState<string | null>(null)

  // Employee Transaction History Modal
  const [txHistoryModalOpen, setTxHistoryModalOpen] = useState(false)
  const [txHistoryEmp, setTxHistoryEmp] = useState<Employee | null>(null)

  // --- Action Handlers (Passed as Props) ---

  // Emps
  const isEmployeeCheckedIn = (empId: string) => {
    const empLog = logs.find(l => l.employee_id === empId)
    return empLog?.type === 'check_in'
  }

  const handleCreateEmployee = async (name: string) => {
    const res = await addEmployee(name)
    if (res.success) {
      toast.success('Сотрудник добавлен!')
      manualRefresh(true)
      return true
    }
    toast.error('Ошибка: ' + res.error)
    return false
  }

  const handleUpdateEmployee = async (id: string, name: string, isActive: boolean) => {
    const res = await updateEmployee(id, name, isActive)
    if (res.success) {
      setEmployees(employees.map(e => e.id === id ? { ...e, name, is_active: isActive } : e))
      toast.success('Изменения сохранены')
      return true
    }
    toast.error('Ошибка: ' + res.error)
    return false
  }

  const handleDeleteEmployee = async (id: string, name: string) => {
    if (!confirm(`Удалить сотрудника "${name}"? Все логи исчезнут.`)) return
    const res = await deleteEmployee(id)
    if (res.success) {
      setEmployees(employees.filter(e => e.id !== id))
      toast.success(`Сотрудник ${name} удален`)
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleResetEmployeeDevice = async (id: string) => {
    if (!confirm('Сбросить привязку устройства?')) return
    const res = await resetDevice(id)
    if (res.success) {
      setEmployees(employees.map(e => e.id === id ? { ...e, device_id: null } : e))
      toast.success('Устройство отвязано')
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleForceCheckOut = async (id: string, name: string) => {
    if (!confirm(`Вы уверены, что хотите завершить смену за ${name}?`)) return
    const res = await forceCheckOutAdmin(id)
    if (res.success) {
      toast.success(`Смена завершена за ${name}`)
      manualRefresh(true)
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleClearAllLogs = async () => {
    const code = prompt('Чтобы удалить ВСЕ логи, введите "ОЧИСТИТЬ" (без кавычек). Это действие необратимо!')
    if (code !== 'ОЧИСТИТЬ') return
    const res = await deleteAllLogs()
    if (res.success) {
      toast.success('Логи полностью очищены')
      manualRefresh(true)
    } else {
      toast.error('Ошибка удаления логов: ' + res.error)
    }
  }

  const handleDeleteLog = async (logId: string) => {
    const res = await deleteLog(logId)
    if (res.success) {
      setLogs(logs.filter(l => l.id !== logId))
      toast.success('Лог удален')
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleUpdateLogTimestamp = async (logId: string, newTimestamp: string) => {
    const res = await updateLogTimestamp(logId, newTimestamp)
    if (res.success) {
      setLogs(logs.map(l => l.id === logId ? { ...l, timestamp: newTimestamp } : l))
      toast.success('Время обновлено')
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleAutoCloseShifts = async () => {
    const res = await autoCloseOpenShifts()
    if (res.success) {
      const count = (res as any).closed || 0
      toast.success(count > 0 ? `Автоматически закрыто смен: ${count}` : 'Открытых смен не найдено')
      if (count > 0) manualRefresh(true)
    } else {
      toast.error('Ошибка: ' + (res as any).error)
    }
  }

  const handleExportExcel = () => {
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

  // Settings
  const handleSaveSettings = async (newIps: string, newGrace: string, newPenalty: string) => {
    const resIp = await updateSetting('allowed_ips', newIps)
    const resGrace = await updateSetting('late_grace_mins', newGrace)
    const resPen = await updateSetting('late_penalty_kzt', newPenalty)

    if (resIp.success && resGrace.success && resPen.success) {
      setAllowedIps(newIps)
      setLateGraceMins(newGrace)
      setLatePenaltyKzt(newPenalty)
      toast.success('Настройки сохранены')
      return true
    } else {
      toast.error('Ошибка сохранения настроек')
      return false
    }
  }

  // --- Modal Submit Handlers ---

  const handleAccrualSubmit = async (empId: string, amount: number) => {
    const res = await processShiftAccrual(empId, amount, 'Ручное начисление / Премия', 'admin')
    if (res.success) {
      toast.success('Начисление прошло успешно!')
      setAccrualModalOpen(false)
      manualRefresh(true)
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleDebtSubmit = async (empId: string, amount: number, comment: string) => {
    const res = await processDebtOrAdvance(empId, amount, comment, 'admin')
    if (res.success) {
      toast.success('Успешно начислен')
      setDebtModalOpen(false)
      manualRefresh(true)
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleWithdrawSubmit = async (empId: string, amount: number) => {
    const res = await withdrawSalary(empId, amount, 'admin')
    if (res.success) {
      toast.success('Средства успешно списаны')
      manualRefresh(true)
      setFinanceModalOpen(false)
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleManualCheckSubmit = async (empId: string, type: 'check_in' | 'check_out', isoString: string) => {
    const res = await manualMarkAttendance(empId, type, isoString)
    if (res.success) {
      toast.success(`Ручная отметка добавлена`)
      manualRefresh(true)
      setManualCheckModalOpen(false)
    } else {
      toast.error('Ошибка: ' + res.error)
    }
  }

  const handleScheduleSubmit = async (empId: string, dayIndex: number, start: string, end: string, salary: number, editingId: string | null) => {
    if (editingId) {
      const res = await updateSchedule(editingId, start, end, salary)
      if (res.success) {
        toast.success('Расписание обновлено')
        manualRefresh(true)
      } else {
        toast.error('Ошибка: ' + res.error)
      }
    } else {
      const res = await addSchedule(empId, dayIndex, start, end, salary)
      if (res.success) {
        toast.success('Расписание добавлено')
        manualRefresh(true)
      } else {
        toast.error('Ошибка добавления: ' + res.error)
      }
    }
    setScheduleModalOpen(false)
  }

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Удалить из расписания?')) return
    const res = await deleteSchedule(id)
    if (res.success) {
      setSchedules(schedules.filter(s => s.id !== id))
      toast.success('Расписание удалено')
    } else {
      toast.error('Ошибка удаления: ' + res.error)
    }
  }

  // Schedule Drop/Edit Hooks
  const handleScheduleDrop = (emp: Employee, dayIndex: number) => {
    // Check dupe
    const alreadyExists = schedules.some(s => s.employee_id === emp.id && s.day_of_week === dayIndex + 1)
    if (alreadyExists) {
      toast.error(`${emp.name} уже назначен(а) на этот день`)
      return
    }
    setScheduleEmp(emp)
    setScheduleDay(dayIndex + 1)
    setScheduleEditingId(null)
    setScheduleInitStart("09:00")
    setScheduleInitEnd("22:00")
    setScheduleInitSalary("5000")
    setScheduleModalOpen(true)
  }

  const handleScheduleEditMode = (sched: Schedule) => {
    const e = employees.find(e => e.id === sched.employee_id)
    if (!e) return
    setScheduleEmp(e)
    setScheduleDay(sched.day_of_week)
    setScheduleEditingId(sched.id)
    setScheduleInitStart(sched.start_time.substring(0, 5))
    setScheduleInitEnd(sched.end_time.substring(0, 5))
    setScheduleInitSalary(sched.shift_salary?.toString() || '0')
    setScheduleModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-gray-900 font-sans pb-20">

      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                <span className="text-white font-black text-xl tracking-tighter">DC</span>
              </div>
              <div>
                <h1 className="text-xl font-extrabold text-gray-900 tracking-tight leading-tight">Админ Панель</h1>
                <p className="text-sm font-semibold text-blue-600">Doner Central</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" className="text-gray-500 hover:text-rose-600 font-bold hidden sm:flex" onClick={() => {
                document.cookie = "admin_auth=; path=/; max-age=0;"
                window.location.href = '/'
              }}>
                <LogOut className="w-4 h-4 mr-2" />
                Выйти
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto hide-scrollbar pb-px -mb-px border-t border-gray-100/50 pt-2 gap-2 text-sm font-bold">
            <Button
              variant={activeTab === 'employees' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('employees')}
              className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'employees' ? 'bg-white text-blue-700 shadow-sm border-t border-l border-r border-gray-200 border-b-white translate-y-px rounded-b-none' : 'text-gray-500 hover:text-gray-900 bg-transparent rounded-b-none'}`}
            >
              <Users className="w-4 h-4" />
              Сотрудники
            </Button>
            <Button
              variant={activeTab === 'schedule' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('schedule')}
              className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'schedule' ? 'bg-white text-blue-700 shadow-sm border-t border-l border-r border-gray-200 border-b-white translate-y-px rounded-b-none' : 'text-gray-500 hover:text-gray-900 bg-transparent rounded-b-none'}`}
            >
              <CalendarIcon className="w-4 h-4" />
              Расписание
            </Button>
            <Button
              variant={activeTab === 'calendar' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('calendar')}
              className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'calendar' ? 'bg-white text-blue-700 shadow-sm border-t border-l border-r border-gray-200 border-b-white translate-y-px rounded-b-none' : 'text-gray-500 hover:text-gray-900 bg-transparent rounded-b-none'}`}
            >
              <CalendarCheck className="w-4 h-4" />
              Календарь
            </Button>
            <Button
              variant={activeTab === 'logs' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('logs')}
              className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'logs' ? 'bg-white text-blue-700 shadow-sm border-t border-l border-r border-gray-200 border-b-white translate-y-px rounded-b-none' : 'text-gray-500 hover:text-gray-900 bg-transparent rounded-b-none'}`}
            >
              <Clock className="w-4 h-4" />
              Логи
            </Button>
            <Button
              variant={activeTab === 'statistics' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('statistics')}
              className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'statistics' ? 'bg-white text-blue-700 shadow-sm border-t border-l border-r border-gray-200 border-b-white translate-y-px rounded-b-none' : 'text-gray-500 hover:text-gray-900 bg-transparent rounded-b-none'}`}
            >
              <BarChart3 className="w-4 h-4" />
              Статистика
            </Button>
            <Button
              variant={activeTab === 'settings' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('settings')}
              className={`flex-none gap-2 px-4 md:px-6 shadow-none transition-all ${activeTab === 'settings' ? 'bg-white text-blue-700 shadow-sm border-t border-l border-r border-gray-200 border-b-white translate-y-px rounded-b-none' : 'text-gray-500 hover:text-gray-900 bg-transparent rounded-b-none'}`}
            >
              <Settings className="w-4 h-4" />
              Настройки
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 min-h-[700px]">

          {activeTab === 'employees' && (
            <EmployeesTab
              employees={employees}
              logs={logs}
              transactions={transactions}
              isEmployeeCheckedIn={isEmployeeCheckedIn}
              onAddEmployee={handleCreateEmployee}
              onSaveEdit={handleUpdateEmployee}
              onDelete={handleDeleteEmployee}
              onResetDevice={handleResetEmployeeDevice}
              openManualCheckModal={(emp, type) => { setManualCheckEmp(emp); setManualCheckType(type); setManualCheckModalOpen(true); }}
              openFinanceModal={(emp) => { setFinanceEmp(emp); setFinanceModalOpen(true); }}
              openDebtModal={(emp) => { setDebtEmp(emp); setDebtModalOpen(true); }}
              openAccrualModal={(emp) => { setAccrualEmp(emp); setAccrualModalOpen(true); }}
              openTransactionHistoryModal={(emp) => { setTxHistoryEmp(emp); setTxHistoryModalOpen(true); }}
            />
          )}

          {activeTab === 'schedule' && (
            <ScheduleTab
              employees={employees}
              schedules={schedules}
              onDropToDay={handleScheduleDrop}
              onEditSchedule={handleScheduleEditMode}
              onDeleteSchedule={handleDeleteSchedule}
            />
          )}

          {activeTab === 'calendar' && <CalendarTab calendarShifts={calendarShifts} />}

          {activeTab === 'logs' && (
            <LogsTab
              logs={logs}
              manualRefresh={() => manualRefresh(true)}
              onExportExcel={handleExportExcel}
              onClearAll={handleClearAllLogs}
              onForceCheckOut={handleForceCheckOut}
              onDeleteLog={handleDeleteLog}
              onUpdateLogTimestamp={handleUpdateLogTimestamp}
              onAutoCloseShifts={handleAutoCloseShifts}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              currentAllowedIps={allowedIps}
              currentLateGraceMins={lateGraceMins}
              currentLatePenalty={latePenaltyKzt}
              onSave={handleSaveSettings}
            />
          )}

          {activeTab === 'statistics' && (
            <StatisticsTab
              employees={employees}
              logs={logs}
              transactions={transactions}
            />
          )}

        </div>
      </div>

      {/* Extracted Modals */}
      <AccrualModal
        isOpen={accrualModalOpen}
        employee={accrualEmp}
        schedules={schedules}
        onClose={() => setAccrualModalOpen(false)}
        onSubmit={handleAccrualSubmit}
      />

      <DebtAdvanceModal
        isOpen={debtModalOpen}
        employee={debtEmp}
        onClose={() => setDebtModalOpen(false)}
        onSubmit={handleDebtSubmit}
      />

      <FinanceWithdrawModal
        isOpen={financeModalOpen}
        employee={financeEmp}
        transactions={transactions}
        onClose={() => setFinanceModalOpen(false)}
        onSubmit={handleWithdrawSubmit}
      />

      <ManualCheckModal
        isOpen={manualCheckModalOpen}
        employee={manualCheckEmp}
        type={manualCheckType}
        onClose={() => setManualCheckModalOpen(false)}
        onSubmit={handleManualCheckSubmit}
      />

      <ScheduleEditModal
        isOpen={scheduleModalOpen}
        employee={scheduleEmp}
        dayIndex={scheduleDay}
        isEditingId={scheduleEditingId}
        initialStart={scheduleInitStart}
        initialEnd={scheduleInitEnd}
        initialSalary={scheduleInitSalary}
        onClose={() => setScheduleModalOpen(false)}
        onSubmit={handleScheduleSubmit}
      />
      <EmployeeTransactionModal
        isOpen={txHistoryModalOpen}
        employeeName={txHistoryEmp?.name || ''}
        transactions={transactions.filter(t => t.employee_id === txHistoryEmp?.id)}
        onClose={() => setTxHistoryModalOpen(false)}
      />

    </div>
  )
}
