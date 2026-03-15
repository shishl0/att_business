'use client'

import { useEffect, useState } from 'react'
import fpPromise from '@fingerprintjs/fingerprintjs'
import { getEmployeeByDevice, getUnlinkedEmployees, linkDevice } from '@/actions/employees'
import { getLastLogAction, markAttendance, isEarlyCheckout } from '@/actions/attendance'
import { getTodaySchedule } from '@/actions/schedule'
import { getTransactions } from '@/actions/finance'
import { Loader2, Fingerprint } from 'lucide-react'

// Local types for Employee page (partial — match what the API returns)
type Employee = { id: string; name: string; balance?: number; device_id?: string | null; is_active?: boolean; created_at?: string }
type Schedule = { id?: string; employee_id?: string; day_of_week?: number; start_time: string; end_time: string; shift_salary: number }
type Transaction = { id: string; amount: number; type: 'accrual' | 'withdrawal'; timestamp: string; comment?: string; source?: string }

// Components
import DeviceLinker from '@/components/employee/DeviceLinker'
import StatusDisplay from '@/components/employee/StatusDisplay'
import AttendanceControls from '@/components/employee/AttendanceControls'
import TransactionHistoryModal from '@/components/employee/modals/TransactionHistoryModal'
import EarlyLeaveModal from '@/components/employee/modals/EarlyLeaveModal'

export default function Home() {
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [todaySchedule, setTodaySchedule] = useState<Schedule | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])

  // Modals
  const [historyOpen, setHistoryOpen] = useState(false)
  const [earlyLeaveModalOpen, setEarlyLeaveModalOpen] = useState(false)

  // Linking state
  const [unlinked, setUnlinked] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [linking, setLinking] = useState(false)

  // Attendance state
  const [lastAction, setLastAction] = useState<'check_in' | 'check_out' | 'break_start' | 'break_end' | null>(null)
  const [checking, setChecking] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function initClient() {
      try {
        let deviceId = localStorage.getItem('attendance_device_id')
        if (!deviceId) {
          try {
            const fp = await fpPromise.load()
            const result = await fp.get()
            deviceId = result.visitorId
          } catch (fpErr) {
            console.warn('FingerprintJS blocked or failed, using UUID fallback')
            deviceId = crypto.randomUUID()
          }
          localStorage.setItem('attendance_device_id', deviceId)
        }
        setFingerprint(deviceId)
        await fetchEmployeeState(deviceId)
      } catch (err) {
        console.error(err)
        setErrorMsg('Ошибка инициализации устройства.')
        setLoading(false)
      }
    }
    initClient()
  }, [])

  async function fetchEmployeeState(fp: string) {
    const emp = await getEmployeeByDevice(fp)
    if (emp) {
      setEmployee(emp)
      const action = await getLastLogAction(emp.id)
      setLastAction(action?.type as any || 'check_out')

      const sched = await getTodaySchedule(emp.id)
      setTodaySchedule(sched)

      const txs = await getTransactions(emp.id)
      setTransactions(txs || [])
    } else {
      const list = await getUnlinkedEmployees()
      setUnlinked(list)
    }
    setLoading(false)
  }

  const isOnSite = lastAction === 'check_in' || lastAction === 'break_end'
  const isOnBreak = lastAction === 'break_start'

  async function handleLink() {
    if (!selectedEmployeeId || !fingerprint) return
    setLinking(true)
    const res = await linkDevice(selectedEmployeeId, fingerprint)
    if (res.success) {
      await fetchEmployeeState(fingerprint)
    } else {
      setErrorMsg(res.error || 'Ошибка привязки')
    }
    setLinking(false)
  }

  async function handleAttendance() {
    if (!employee || !fingerprint) return
    const type = lastAction === 'check_in' || lastAction === 'break_end' ? 'check_out' : 'check_in'

    if (type === 'check_out') {
      const earlyCheck = await isEarlyCheckout(employee.id)
      if (earlyCheck.isEarly) {
        setEarlyLeaveModalOpen(true)
        return
      }
    }
    await performAttendanceSubmit(type)
  }

  async function handleBreak(start: boolean) {
    if (!employee) return
    const type = start ? 'break_start' : 'break_end'
    await performAttendanceSubmit(type)
  }

  async function performAttendanceSubmit(type: string, comment?: string) {
    setChecking(true)
    setErrorMsg('')
    try {
      const res = await markAttendance(employee!.id, type, comment)
      if (res.success) {
        setLastAction(type as any)
        if (type === 'check_out') {
          await fetchEmployeeState(fingerprint!)
        }
      } else {
        setErrorMsg(res.error || 'Ошибка записи: ' + res.error)
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Произошла непредвиденная ошибка')
    } finally {
      setChecking(false)
    }
  }

  const handleEarlyLeaveSubmit = async (reason: string) => {
    setEarlyLeaveModalOpen(false)
    await performAttendanceSubmit('check_out', `Ранний уход: ${reason}`)
  }

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-4" />
        <p className="text-gray-500 animate-pulse text-sm font-medium">Инициализация устройства...</p>
      </div>
    )
  }

  return (
    <main className="min-h-[100dvh] bg-[#fdfeff] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      <div className="w-full max-w-[380px] relative">
        {errorMsg && (
          <div className="absolute -top-12 left-0 right-0 animate-in slide-in-from-top-4 duration-300 z-50">
            <div className="mx-4 p-3 bg-white/90 backdrop-blur-md border border-red-100 shadow-lg shadow-red-500/10 rounded-2xl flex items-center gap-3">
              <div className="w-2 h-8 bg-red-500 rounded-full shrink-0" />
              <p className="text-red-600 text-[13px] font-bold leading-tight">{errorMsg}</p>
            </div>
          </div>
        )}
        <div className="bg-white/80 backdrop-blur-2xl rounded-[48px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.08)] border border-white overflow-hidden relative">
          <div className="px-6 pt-8 pb-10 space-y-8 flex flex-col items-center">

            {!employee ? (
              <div className="w-full animate-in fade-in zoom-in-95 duration-500">
                <DeviceLinker
                  unlinked={unlinked}
                  selectedEmployeeId={selectedEmployeeId}
                  setSelectedEmployeeId={setSelectedEmployeeId}
                  onLink={handleLink}
                  isLinking={linking}
                />
              </div>
            ) : (
              <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-100">

                {/* Секция статуса с небольшим отступом */}
                <div className="mb-2 w-full">
                  <StatusDisplay employee={employee} todaySchedule={todaySchedule} />
                </div>

                {/* Основные кнопки управления */}
                <div className="relative z-10 w-full flex flex-col items-center">
                  <AttendanceControls
                    isOnSite={isOnSite}
                    isOnBreak={isOnBreak}
                    lastAction={lastAction}
                    isChecking={checking}
                    onAttendanceMatch={handleAttendance}
                    onBreakMatch={handleBreak}
                    onOpenHistory={() => setHistoryOpen(true)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Модалки */}
      <TransactionHistoryModal
        isOpen={historyOpen}
        transactions={transactions}
        onClose={() => setHistoryOpen(false)}
      />

      <EarlyLeaveModal
        isOpen={earlyLeaveModalOpen}
        isSubmitting={checking}
        onClose={() => setEarlyLeaveModalOpen(false)}
        onSubmit={handleEarlyLeaveSubmit}
      />
    </main>
  )
}
