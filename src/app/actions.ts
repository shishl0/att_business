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

  // IP check
  if (finalIp !== allowedIp && allowedIp !== '*') {
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

export async function addSchedule(employeeId: string, dayOfWeek: number, startTime: string, endTime: string) {
  const { error } = await supabase
    .from('schedules')
    .insert([{ employee_id: employeeId, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime }])
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateSchedule(id: string, startTime: string, endTime: string) {
  const { error } = await supabase
    .from('schedules')
    .update({ start_time: startTime, end_time: endTime })
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

export async function getAdminDashboardData() {
  const [employees, logs, schedules] = await Promise.all([
    getEmployees(),
    getLogs(),
    getSchedules()
  ])
  return { success: true, employees, logs, schedules }
}
