'use server'

import { supabase } from '@/lib/supabase'

export async function getTodaySchedule(employeeId: string) {
    const now = new Date()
    const dayOfWeek = now.getDay() || 7
    const { data: sched } = await supabase
        .from('schedules')
        .select('start_time, end_time, shift_salary')
        .eq('employee_id', employeeId)
        .eq('day_of_week', dayOfWeek)
        .single()

    return sched
}

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
