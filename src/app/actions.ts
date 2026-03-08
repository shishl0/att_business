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
  return { success: true, type }
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

export async function processShiftAccrual(employeeId: string, amount: number) {
  if (amount <= 0) return { success: false, error: 'Сумма должна быть больше 0' }

  // 1. Get current balance
  const { data: emp, error: empErr } = await supabase
    .from('employees')
    .select('balance')
    .eq('id', employeeId)
    .single()

  if (empErr) return { success: false, error: empErr.message }

  // 2. Insert transaction
  const { error: txErr } = await supabase
    .from('transactions')
    .insert([{ employee_id: employeeId, amount, type: 'accrual' }])

  if (txErr) return { success: false, error: txErr.message }

  // 3. Update balance
  const newBalance = (Number(emp.balance) || 0) + Number(amount)
  const { error: updErr } = await supabase
    .from('employees')
    .update({ balance: newBalance })
    .eq('id', employeeId)

  if (updErr) return { success: false, error: updErr.message }

  return { success: true, newBalance }
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
