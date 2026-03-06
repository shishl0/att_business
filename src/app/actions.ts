'use server'

import { supabase } from '@/lib/supabase'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'

export async function getEmployeeByDevice(fingerprint: string) {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .eq('device_id', fingerprint)
    .eq('is_active', true)
    .single()
  
  if (error && error.code !== 'PGRST116') {
    console.error('getEmployeeByDevice Error:', error)
  }
  return data
}

export async function getUnlinkedEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .is('device_id', null)
    .eq('is_active', true)
    
  if (error) {
    console.error('getUnlinkedEmployees Error:', error)
    return []
  }
  return data || []
}

export async function linkDevice(employeeId: string, fingerprint: string) {
  const { error } = await supabase
    .from('employees')
    .update({ device_id: fingerprint })
    .eq('id', employeeId)

  if (error) {
    return { success: false, error: error.message }
  }
  
  revalidatePath('/')
  return { success: true }
}

export async function getLastLogAction(employeeId: string) {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('type, timestamp')
    .eq('employee_id', employeeId)
    .order('timestamp', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('getLastLogAction Error:', error)
  }

  return data
}

export async function markAttendance(employeeId: string, type: 'check_in' | 'check_out') {
  // Try to get IP from headers
  const headersList = await headers()
  const forwardedFor = headersList.get('x-forwarded-for')
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0] : 'unknown'

  const { error } = await supabase
    .from('attendance_logs')
    .insert({
      employee_id: employeeId,
      type,
      ip_address: ipAddress
    })

  if (error) {
    return { success: false, error: error.message }
  }
  
  revalidatePath('/')
  return { success: true }
}

// ---- Admin Actions ----

export async function getEmployees() {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false })

  return data || []
}

export async function getLogs() {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*, employees(name)')
    .order('timestamp', { ascending: false })
    .limit(1000)

  return data || []
}

export async function addEmployee(name: string) {
  const { error } = await supabase
    .from('employees')
    .insert({ name })

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function resetDevice(employeeId: string) {
  const { error } = await supabase
    .from('employees')
    .update({ device_id: null })
    .eq('id', employeeId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function updateEmployee(id: string, name: string, isActive: boolean) {
  const { error } = await supabase
    .from('employees')
    .update({ name, is_active: isActive })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/admin')
  return { success: true }
}
