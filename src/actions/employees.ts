'use server'

import { supabase } from '@/lib/supabase'

export async function getEmployeeByDevice(deviceId: string) {
    const { data } = await supabase
        .from('employees')
        .select('id, name, balance')
        .eq('device_id', deviceId)
        .eq('is_active', true)
        .single()
    return data
}

export async function getUnlinkedEmployees() {
    const { data } = await supabase
        .from('employees')
        .select('id, name')
        .eq('is_active', true)
        .order('name')
    return data || []
}

export async function linkDevice(employeeId: string, deviceId: string) {
    const { error } = await supabase
        .from('employees')
        .update({ device_id: deviceId })
        .eq('id', employeeId)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function getEmployees() {
    const { data } = await supabase
        .from('employees')
        .select('*')
        .order('name')
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
