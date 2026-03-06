'use client'

import { useEffect, useState } from 'react'
import fpPromise from '@fingerprintjs/fingerprintjs'
import { getEmployeeByDevice, getUnlinkedEmployees, linkDevice, getLastLogAction, markAttendance } from './actions'
import { Loader2, Fingerprint } from 'lucide-react'

type Employee = { id: string, name: string }

export default function Home() {
  const [fingerprint, setFingerprint] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<Employee | null>(null)

  const [unlinked, setUnlinked] = useState<Employee[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [linking, setLinking] = useState(false)

  const [lastAction, setLastAction] = useState<'check_in' | 'check_out' | null>(null)
  const [checking, setChecking] = useState(false)

  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function initClient() {
      try {
        const fp = await fpPromise.load()
        const result = await fp.get()
        const fpId = result.visitorId
        setFingerprint(fpId)

        await fetchEmployeeState(fpId)
      } catch (err) {
        console.error(err)
        setErrorMsg('Ошибка получения Fingerprint устройства.')
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
      setLastAction(action?.type || 'check_out')
    } else {
      const list = await getUnlinkedEmployees()
      setUnlinked(list)
    }
    setLoading(false)
  }

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
    setChecking(true)
    const type = lastAction === 'check_in' ? 'check_out' : 'check_in'

    const res = await markAttendance(employee.id, type)
    if (res.success) {
      setLastAction(type)
    } else {
      setErrorMsg(res.error || 'Ошибка записи: ' + res.error)
    }
    setChecking(false)
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
    <main className="min-h-[100dvh] bg-blue-50/50 flex flex-col justify-center items-center py-8 px-4 relative overflow-hidden">

      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[120%] h-[50%] bg-blue-600 rounded-b-[40%] shadow-lg -z-10"></div>

      <div className="w-full max-w-sm bg-white rounded-[32px] shadow-2xl overflow-hidden shadow-black/10 relative pb-10">

        <div className="flex flex-col items-center pt-8 pb-4 relative">
          <Fingerprint className="text-blue-100 w-24 h-24 absolute -top-8 -right-4 transform rotate-12 opacity-50 pointer-events-none" />
          <div className="z-10 text-center space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight px-4 text-blue-900">Doner центральный</h1>
            <p className="text-blue-500 text-sm font-semibold tracking-wide uppercase">Учет времени</p>
          </div>
        </div>

        <div className="px-6 pt-4 space-y-6 flex flex-col items-center z-10 relative bg-white">
          {errorMsg && (
            <div className="w-full p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-semibold text-center border border-red-100 shadow-sm shadow-red-100">
              {errorMsg}
            </div>
          )}

          {!employee ? (
            <div className="w-full space-y-5 flex flex-col items-center">
              <div className="bg-orange-50/80 p-5 rounded-2xl w-full border border-orange-100/50">
                <h2 className="text-[15px] font-bold text-orange-900 text-center mb-1.5 flex items-center justify-center gap-2">
                  <Fingerprint className="w-4 h-4 text-orange-600" />
                  Устройство не привязано
                </h2>
                <p className="text-[13px] text-orange-700/80 text-center leading-relaxed font-medium">
                  Выберите себя из списка, чтобы закрепить телефон за вами.
                </p>
              </div>

              {unlinked.length > 0 ? (
                <div className="w-full space-y-4 pt-2">
                  <div className="relative">
                    <select
                      className="w-full p-4 bg-gray-50/50 border border-gray-200 text-gray-900 font-medium text-sm rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none pr-10 hover:bg-gray-50 cursor-pointer shadow-sm"
                      value={selectedEmployeeId}
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                    >
                      <option value="" disabled>Выберите свое имя...</option>
                      {unlinked.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                    </div>
                  </div>

                  <button
                    onClick={handleLink}
                    disabled={!selectedEmployeeId || linking}
                    className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20 transition-all disabled:opacity-60 flex justify-center items-center h-[56px] disabled:hover:bg-blue-600"
                  >
                    {linking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Подтвердить привязку'}
                  </button>
                </div>
              ) : (
                <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl w-full">
                  <p className="text-sm font-medium text-center text-gray-500">
                    Нет доступных сотрудников. Обратитесь к администратору.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full flex flex-col items-center space-y-8 pb-4">
              <div className="text-center bg-gray-50/80 px-8 py-4 rounded-3xl border border-gray-100 w-full shadow-sm">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Сотрудник</p>
                <h2 className="text-2xl font-extrabold text-gray-900 leading-tight">
                  {employee.name}
                </h2>
              </div>

              <button
                onClick={handleAttendance}
                disabled={checking}
                style={{ WebkitTapHighlightColor: 'transparent' }}
                className={`group relative w-[200px] h-[200px] rounded-full text-3xl font-black text-white shadow-2xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.97] flex items-center justify-center outline-none select-none
                  ${lastAction === 'check_in'
                    ? 'bg-gradient-to-tr from-rose-500 via-red-500 to-red-600 shadow-rose-500/40 disabled:opacity-80'
                    : 'bg-gradient-to-tr from-emerald-500 via-green-500 to-emerald-600 shadow-emerald-500/40 disabled:opacity-80'
                  }`}
              >
                <div className="absolute inset-2 rounded-full border-4 border-white/20 transition-transform group-hover:scale-105 group-active:scale-95 duration-300"></div>
                {checking ? (
                  <Loader2 className="w-12 h-12 animate-spin" />
                ) : (
                  lastAction === 'check_in' ? 'УЙТИ' : 'ПРИЙТИ'
                )}
              </button>

              <div className={`px-5 py-2.5 rounded-full text-[13px] font-bold tracking-wide transition-colors flex items-center gap-2 shadow-sm ${lastAction === 'check_in'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                {lastAction === 'check_in' ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    ВЫ НА РАБОЧЕМ МЕСТЕ
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                    ОТСУТСТВУЕТЕ
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
