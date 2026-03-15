'use server'

import { supabase, allowedIp } from '@/lib/supabase'
import { headers } from 'next/headers'
import { computeStrictAutoSalary } from './finance'

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

export async function getLogs() {
    const { data } = await supabase
        .from('attendance_logs')
        .select('*, employees(name)')
        .order('timestamp', { ascending: false })
    return data || []
}

export async function deleteAllLogs() {
    const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .not('id', 'is', null) // Delete all records (UUIDs don't work with .gt)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function deleteLog(logId: string) {
    const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('id', logId)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function updateLogTimestamp(logId: string, newTimestamp: string) {
    const { error } = await supabase
        .from('attendance_logs')
        .update({ timestamp: newTimestamp })
        .eq('id', logId)

    if (error) return { success: false, error: error.message }
    return { success: true }
}

// Auto-close shifts that have been open for more than 16 hours
export async function autoCloseOpenShifts() {
    try {
        // Get all employees with an open check_in
        const { data: openShifts } = await supabase
            .from('attendance_logs')
            .select('employee_id, timestamp')
            .eq('type', 'check_in')
            .order('timestamp', { ascending: false })

        if (!openShifts || openShifts.length === 0) return { success: true, closed: 0 }

        // Deduplicate: only the MOST RECENT log per employee matters
        const latestByEmployee: Record<string, string> = {}
        for (const log of openShifts) {
            if (!latestByEmployee[log.employee_id]) {
                latestByEmployee[log.employee_id] = log.timestamp
            }
        }

        // For each employee with an open shift, check if the LAST action is check_in
        const now = new Date()
        const sixteenHoursAgo = new Date(now.getTime() - 16 * 60 * 60 * 1000)
        let closedCount = 0

        for (const [empId, lastCheckIn] of Object.entries(latestByEmployee)) {
            // Verify the very last log action is check_in
            const { data: lastLog } = await supabase
                .from('attendance_logs')
                .select('type, timestamp')
                .eq('employee_id', empId)
                .order('timestamp', { ascending: false })
                .limit(1)
                .single()

            if (!lastLog || lastLog.type !== 'check_in') continue

            // Only auto-close if check_in was more than 16 hours ago
            const checkInTime = new Date(lastLog.timestamp)
            if (checkInTime > sixteenHoursAgo) continue

            // Insert auto-checkout at end of their scheduled shift (or 16h after check-in)
            const autoCheckoutTime = new Date(checkInTime.getTime() + 16 * 60 * 60 * 1000)

            const { error } = await supabase
                .from('attendance_logs')
                .insert([{
                    employee_id: empId,
                    type: 'check_out',
                    ip_address: 'Система (Авто-завершение смены)',
                    timestamp: autoCheckoutTime.toISOString(),
                    comment: 'Автоматическое завершение — сотрудник забыл отметить уход'
                }])

            if (!error) {
                await computeStrictAutoSalary(empId, autoCheckoutTime)
                closedCount++
            }
        }

        return { success: true, closed: closedCount }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function markAttendance(
    employeeId: string,
    type: string,
    comment?: string
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

    const payload: any = { employee_id: employeeId, type, ip_address: finalIp }
    if (comment && comment.trim() !== '') {
        payload.comment = comment.trim()
    }

    const { error: insErr } = await supabase
        .from('attendance_logs')
        .insert([payload])

    if (insErr) return { success: false, error: insErr.message }

    // Phase 3: Auto-Salary computation on checkout
    if (type === 'check_out') {
        await computeStrictAutoSalary(employeeId, new Date())
    }

    return { success: true, type }
}

export async function markAttendanceWithComment(
    employeeId: string,
    type: string,
    comment: string
) {
    return markAttendance(employeeId, type as any, comment as any)
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

    if (type === 'check_out') {
        const checkoutTime = timestampStr ? new Date(timestampStr) : new Date()
        await computeStrictAutoSalary(employeeId, checkoutTime)
    }

    return { success: true, type }
}

export async function forceCheckOutAdmin(employeeId: string) {
    const now = new Date()
    const { error } = await supabase
        .from('attendance_logs')
        .insert([{
            employee_id: employeeId,
            type: 'check_out',
            ip_address: 'Администратор (Принудительно)',
            timestamp: now.toISOString()
        }])

    if (error) return { success: false, error: error.message }

    await computeStrictAutoSalary(employeeId, now)

    return { success: true }
}

export async function isEarlyCheckout(employeeId: string) {
    try {
        const { data: logs } = await supabase
            .from('attendance_logs')
            .select('type, timestamp')
            .eq('employee_id', employeeId)
            .order('timestamp', { ascending: false })
            .limit(2)

        if (!logs || logs.length === 0) return { isEarly: false }
        if (logs[0].type !== 'check_in') return { isEarly: false }

        const checkInTime = new Date(logs[0].timestamp)
        const now = new Date()

        // Find schedule for the day of checkInTime
        const checkInDay = checkInTime.getDay() || 7
        const { data: sched } = await supabase
            .from('schedules')
            .select('start_time, end_time')
            .eq('employee_id', employeeId)
            .eq('day_of_week', checkInDay)
            .single()

        if (!sched) return { isEarly: false }

        const [schedEndH, schedEndM] = sched.end_time.split(':').map(Number)
        const [schedStartH] = sched.start_time.split(':').map(Number)

        const plannedEnd = new Date(checkInTime)
        plannedEnd.setHours(schedEndH, schedEndM, 0, 0)

        if (schedEndH < schedStartH) {
            plannedEnd.setDate(plannedEnd.getDate() + 1)
        }

        const maxEarlyLeave = new Date(plannedEnd.getTime() - 60 * 60000)

        if (now < maxEarlyLeave) {
            return { isEarly: true, endTime: sched.end_time }
        }

        return { isEarly: false }
    } catch (e) {
        return { isEarly: false }
    }
}
