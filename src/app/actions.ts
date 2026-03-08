'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const allowedIp = process.env.NEXT_PUBLIC_ALLOWED_IP!

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
})

// === Settings actions ===
export async function getSetting(key: string) {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', key).single()
    return data?.value || null
  } catch (e) {
    return null
  }
}

export async function updateSetting(key: string, value: string) {
  try {
    const { error } = await supabase.from('settings').upsert({ key, value })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// === Employee actions ===

export async function getEmployeeByDevice(deviceId: string) {
  const { data } = await supabase
    .from('employees')
    .select('id, name')
    .eq('device_id', deviceId)
    .eq('is_active', true)
    .single()
  return data
}

export async function getUnlinkedEmployees() {
  const { data } = await supabase
    .from('employees')
    .select('id, name')
    .is('device_id', null)
    .eq('is_active', true)
    .order('name')
  return data || []
}

export async function getLastLogAction(employeeId: string) {
  const { data } = await supabase
    .from('attendance_logs')
    .select('type')
    .eq('employee_id', employeeId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()
  return data
}

export async function linkDevice(employeeId: string, deviceId: string) {
  const { error } = await supabase
    .from('employees')
    .update({ device_id: deviceId })
    .eq('id', employeeId)

  if (error) return { success: false, error: error.message }
  return { success: true }
}

import { headers } from 'next/headers'

export async function markAttendance(
  employeeId: string,
  type: string
) {
  const headersList = await headers()
  const rawIp = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'

  // Strip IPv6 prefix if present
  let finalIp = rawIp.split(',')[0].trim()
  if (finalIp.startsWith('::ffff:')) {
    finalIp = finalIp.substring(7)
  }

  // Get allowed IP regex from DB, fallback to env
  let ipRegexStr = allowedIp
  try {
    const { data: setting } = await supabase.from('settings').select('value').eq('key', 'allowed_ips').single()
    if (setting && setting.value) {
      ipRegexStr = setting.value
    }
  } catch (e) {
    console.error("Error fetching allowed_ips setting:", e)
  }

  // IP check using RegExp
  let isAllowed = false
  if (ipRegexStr === '*') {
    isAllowed = true
  } else {
    try {
      const regex = new RegExp(ipRegexStr)
      isAllowed = regex.test(finalIp)
    } catch (e) {
      // Fallback if regex is invalid
      isAllowed = finalIp === ipRegexStr
    }
  }

  if (!isAllowed) {
    return { success: false, error: `Доступ запрещен. Ваш IP: ${finalIp}. Пожалуйста, подключитесь к рабочей сети Wi-Fi ресторана (Doner Centr 5G).` }
  }

  const { data: emp } = await supabase
    .from('employees')
    .select('device_id, is_active')
    .eq('id', employeeId)
    .single()

  if (!emp) return { success: false, error: 'Сотрудник не найден' }
  if (emp.is_active === false) return { success: false, error: 'Сотрудник в архиве' }

  const { error: insErr } = await supabase
    .from('attendance_logs')
    .insert([{ employee_id: employeeId, type, ip_address: finalIp }])

  if (insErr) return { success: false, error: insErr.message }

  // Phase 3: Auto-Salary computation on checkout
  if (type === 'check_out') {
    await computeStrictAutoSalary(employeeId, new Date())
  }

  return { success: true, type }
}

async function computeStrictAutoSalary(employeeId: string, checkoutTime: Date) {
  try {
    // 1. Get the check_in time for today
    const startOfDay = new Date(checkoutTime)
    startOfDay.setHours(0, 0, 0, 0)

    const { data: logs } = await supabase
      .from('attendance_logs')
      .select('type, timestamp')
      .eq('employee_id', employeeId)
      .gte('timestamp', startOfDay.toISOString())
      .lte('timestamp', checkoutTime.toISOString())
      .order('timestamp', { ascending: true })

    if (!logs || logs.length === 0) return

    // Find the matching check-in
    let checkInTime: Date | null = null
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].type === 'check_in') {
        checkInTime = new Date(logs[i].timestamp)
        break
      }
    }

    if (!checkInTime) return // No check-in found for this check-out

    // 2. Get today's schedule
    const dayOfWeek = checkoutTime.getDay() || 7
    const { data: sched } = await supabase
      .from('schedules')
      .select('start_time, end_time, shift_salary')
      .eq('employee_id', employeeId)
      .eq('day_of_week', dayOfWeek)
      .single()

    if (!sched || !sched.shift_salary) return

    // 3. Parse schedule times
    const [schedStartH, schedStartM] = sched.start_time.split(':').map(Number)
    const [schedEndH, schedEndM] = sched.end_time.split(':').map(Number)

    const plannedStart = new Date(checkInTime)
    plannedStart.setHours(schedStartH, schedStartM, 0, 0)

    const plannedEnd = new Date(checkoutTime)
    plannedEnd.setHours(schedEndH, schedEndM, 0, 0)

    // Handle overnight shifts in scheduled end time
    if (schedEndH < schedStartH) {
      plannedEnd.setDate(plannedEnd.getDate() + 1)
    }

    // 4. Validate Early/Late bounds
    // Late limit: 30 mins
    const maxLateTime = new Date(plannedStart.getTime() + 30 * 60000)
    const isLate = checkInTime > maxLateTime

    // Early leave limit: 1 hour
    const maxEarlyLeave = new Date(plannedEnd.getTime() - 60 * 60000)
    const isEarlyLeave = checkoutTime < maxEarlyLeave

    if (!isLate && !isEarlyLeave) {
      // Auto-accrue salary
      await processShiftAccrual(employeeId, sched.shift_salary)
    } else {
      let penaltyComment = 'Штраф: '
      if (isLate) penaltyComment += 'Опоздание. '
      if (isEarlyLeave) penaltyComment += 'Ранний уход.'

      // Auto-accrue with 50% penalty? According to requirements "fixed or percent penalty" can be set in settings.
      // For now, let's accrue with a fixed 50% penalty if settings are absent, or simply do not accrue.
      // The user requested a penalty. Let's retrieve penalty_rate from settings.
      const penaltyRateStr = await getSetting('penalty_rate') // eg. "50" for 50%
      const penaltyRate = penaltyRateStr ? Number(penaltyRateStr) : 50

      if (penaltyRate > 0 && penaltyRate <= 100) {
        const finalSalary = Math.floor(sched.shift_salary * ((100 - penaltyRate) / 100))
        if (finalSalary > 0) {
          // Add the transaction with comment about the penalty
          await processShiftAccrual(employeeId, finalSalary, penaltyComment)
        }
      }
    }
  } catch (e) {
    console.error("Auto Salary Error", e)
  }
}

export async function manualMarkAttendance(
  employeeId: string,
  type: string,
  timestampStr?: string
) {
  // timestampStr should be an ISO string if provided, otherwise defaults to now
  const payload: any = {
    employee_id: employeeId,
    type,
    ip_address: 'Администратор (Ручной ввод)'
  }
  if (timestampStr) {
    payload.timestamp = timestampStr
  }

  const { error: insErr } = await supabase
    .from('attendance_logs')
    .insert([payload])

  if (insErr) return { success: false, error: insErr.message }
  return { success: true, type }
}

// === Admin actions ===

export async function getEmployees() {
  const { data } = await supabase
    .from('employees')
    .select('*')
    .order('name')
  return data || []
}

export async function getLogs() {
  const { data } = await supabase
    .from('attendance_logs')
    .select('*, employees(name)')
    .order('timestamp', { ascending: false })
  return data || []
}

export async function addEmployee(name: string) {
  const { error } = await supabase
    .from('employees')
    .insert([{ name }])
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateEmployee(id: string, name: string, is_active: boolean) {
  const { error } = await supabase
    .from('employees')
    .update({ name, is_active })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function resetDevice(id: string) {
  const { error } = await supabase
    .from('employees')
    .update({ device_id: null })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function forceCheckOutAdmin(employeeId: string) {
  const { error } = await supabase
    .from('attendance_logs')
    .insert([{
      employee_id: employeeId,
      type: 'check_out',
      ip_address: 'Администратор (Принудительно)'
    }])

  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteAllLogs() {
  const { error } = await supabase
    .from('attendance_logs')
    .delete()
    .gt('id', 0) // Delete all records where ID > 0

  if (error) return { success: false, error: error.message }
  return { success: true }
}

// === Schedules CRUD === //

export async function getSchedules() {
  const { data } = await supabase
    .from('schedules')
    .select('*, employees(name)')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })
  return data || []
}

export async function addSchedule(employeeId: string, dayOfWeek: number, startTime: string, endTime: string, shiftSalary: number = 0) {
  const { error } = await supabase
    .from('schedules')
    .insert([{ employee_id: employeeId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, shift_salary: shiftSalary }])
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateSchedule(id: string, startTime: string, endTime: string, shiftSalary: number = 0) {
  const { error } = await supabase
    .from('schedules')
    .update({ start_time: startTime, end_time: endTime, shift_salary: shiftSalary })
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function deleteSchedule(id: string) {
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// === Financial / Deposit actions === //

export async function getTransactions(employeeId?: string) {
  let query = supabase.from('transactions').select('*').order('timestamp', { ascending: false })
  if (employeeId) {
    query = query.eq('employee_id', employeeId)
  }
  const { data } = await query
  return data || []
}

// === Transaction and Balance Actions ===

// internal helper
export async function processShiftAccrual(employeeId: string, amount: number, commentStr: string = 'Отметки завершены успешно') {
  try {
    const { data: emp, error: empErr } = await supabase
      .from('employees')
      .select('balance, name')
      .eq('id', employeeId)
      .single()

    if (empErr) return { success: false, error: empErr.message }

    const newBalance = Number(emp.balance || 0) + Number(amount)

    const { error: updErr } = await supabase
      .from('employees')
      .update({ balance: newBalance })
      .eq('id', employeeId)

    if (updErr) return { success: false, error: updErr.message }

    const { error: txErr } = await supabase
      .from('transactions')
      .insert({
        employee_id: employeeId,
        amount: amount,
        type: 'accrual',
        comment: commentStr
      })

    if (txErr) return { success: false, error: txErr.message }

    return { success: true, newBalance }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function processDebtOrAdvance(employeeId: string, amount: number, comment: string) {
  try {
    const { data: emp, error: empErr } = await supabase
      .from('employees')
      .select('balance')
      .eq('id', employeeId)
      .single()

    if (empErr) return { success: false, error: empErr.message }

    const newBalance = Number(emp.balance || 0) - Number(amount)

    const { error: updErr } = await supabase
      .from('employees')
      .update({ balance: newBalance })
      .eq('id', employeeId)

    if (updErr) return { success: false, error: updErr.message }

    const { error: txErr } = await supabase
      .from('transactions')
      .insert({
        employee_id: employeeId,
        amount: amount, // Positive amount stored, but type dictates subtraction
        type: 'withdrawal',
        comment: comment
      })

    if (txErr) return { success: false, error: txErr.message }

    return { success: true, newBalance }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

export async function withdrawSalary(employeeId: string, amount: number) {
  if (amount <= 0) return { success: false, error: 'Сумма должна быть больше 0' }

  // 1. Get current balance
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('balance')
    .eq('id', employeeId)
    .single()

  if (empErr) return { success: false, error: empErr.message }

  const currentBalance = Number(emp.balance) || 0
  if (currentBalance < amount) return { success: false, error: 'Недостаточно средств на депозите' }

  // 2. Insert transaction
  const { error: txErr } = await supabase
    .from('transactions')
    .insert([{ employee_id: employeeId, amount, type: 'withdrawal' }])

  if (txErr) return { success: false, error: txErr.message }

  // 3. Update balance
  const newBalance = currentBalance - Number(amount)
  const { error: updErr } = await supabase
    .from('employees')
    .update({ balance: newBalance })
    .eq('id', employeeId)

  if (updErr) return { success: false, error: updErr.message }

  return { success: true, newBalance }
}

export async function getAdminDashboardData() {
  const [employees, logs, schedules, transactions, ipSetting] = await Promise.all([
    getEmployees(),
    getLogs(),
    getSchedules(),
    getTransactions(),
    getSetting('allowed_ips')
  ])
  return { success: true, employees, logs, schedules, transactions, allowed_ips: ipSetting || '.*' }
}
