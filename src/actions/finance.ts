'use server'

import { supabase } from '@/lib/supabase'
import { getSetting } from './settings'

export async function processShiftAccrual(employeeId: string, amount: number, commentStr: string = 'Отметки завершены успешно', source: string = 'system') {
    try {
        // Check 12h limit for system accruals
        if (source === 'system') {
            const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()
            const { data: recentAccruals } = await supabase
                .from('transactions')
                .select('id')
                .eq('employee_id', employeeId)
                .eq('type', 'accrual')
                .eq('source', 'system')
                .gte('timestamp', twelveHoursAgo)
                .limit(1)

            if (recentAccruals && recentAccruals.length > 0) {
                return { success: false, error: 'Начисление зарплаты возможно только 1 раз в 12 часов.' }
            }
        }

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
                comment: commentStr,
                source: source
            })

        if (txErr) return { success: false, error: txErr.message }

        return { success: true, newBalance }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function processDebtOrAdvance(employeeId: string, amount: number, comment: string, source: string = 'admin') {
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
                comment: comment,
                source: source
            })

        if (txErr) return { success: false, error: txErr.message }

        return { success: true, newBalance }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function withdrawSalary(employeeId: string, amount: number, source: string = 'admin') {
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
        .insert([{ employee_id: employeeId, amount, type: 'withdrawal', comment: 'Снятие зарплаты', source: source }])

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

export async function getTransactions(employeeId?: string) {
    let query = supabase.from('transactions').select('*').order('timestamp', { ascending: false })
    if (employeeId) {
        query = query.eq('employee_id', employeeId)
    }
    const { data } = await query
    return data || []
}

export async function computeStrictAutoSalary(employeeId: string, checkoutTime: Date) {
    try {
        // 1. Grab the last two logs (must be [check_out, check_in] to be valid)
        const { data: logs } = await supabase
            .from('attendance_logs')
            .select('id, type, timestamp')
            .eq('employee_id', employeeId)
            .order('timestamp', { ascending: false })
            .limit(2)

        if (!logs || logs.length < 2) return
        if (logs[0].type !== 'check_out' || logs[1].type !== 'check_in') return // They spammed check_out or it's messed up

        const checkOutLog = logs[0]
        const checkInLog = logs[1]

        const checkInTime = new Date(checkInLog.timestamp)

        // 2. See if there's already an accrual for THIS specific checkInTime -> checkoutTime window
        // We check if an accrual happened after the check_in
        const { data: existingAccruals } = await supabase
            .from('transactions')
            .select('id')
            .eq('employee_id', employeeId)
            .eq('type', 'accrual')
            .gte('timestamp', checkInLog.timestamp)
            .limit(1)

        if (existingAccruals && existingAccruals.length > 0) return // Already paid out for this shift

        // 3. Find Schedule
        const checkInDay = checkInTime.getDay() || 7
        const { data: sched } = await supabase
            .from('schedules')
            .select('start_time, end_time, shift_salary')
            .eq('employee_id', employeeId)
            .eq('day_of_week', checkInDay)
            .single()

        if (!sched || !sched.shift_salary) return

        // Parse schedule times
        const [schedStartH, schedStartM] = sched.start_time.split(':').map(Number)
        const [schedEndH, schedEndM] = sched.end_time.split(':').map(Number)

        const plannedStart = new Date(checkInTime)
        plannedStart.setHours(schedStartH, schedStartM, 0, 0)

        const plannedEnd = new Date(checkoutTime)
        plannedEnd.setHours(schedEndH, schedEndM, 0, 0)

        if (schedEndH < schedStartH) {
            plannedEnd.setDate(plannedEnd.getDate() + 1)
        }

        // Settings for penalties
        const lateGraceMins = parseInt(await getSetting('late_grace_mins') || '15', 10)
        const latePenaltyKzt = parseInt(await getSetting('late_penalty_kzt') || '1000', 10)

        // Bounds check
        const maxLateTime = new Date(plannedStart.getTime() + lateGraceMins * 60000)
        const isLate = checkInTime > maxLateTime

        const maxEarlyLeave = new Date(plannedEnd.getTime() - 60 * 60000)
        const isEarlyLeave = checkoutTime < maxEarlyLeave

        let comment = 'Отработал смену'
        if (isLate || isEarlyLeave) {
            comment = 'Отметка о смене (со штрафным предупреждением): '
            if (isLate) comment += `Опоздание (>${lateGraceMins} мин). `
            if (isEarlyLeave) comment += 'Ранний уход.'
        }

        // Penalty execution
        if (isLate && latePenaltyKzt > 0) {
            await processDebtOrAdvance(employeeId, latePenaltyKzt, `Штраф за опоздание (>${lateGraceMins} мин)`, 'system')
        }

        // Always issue the full shift salary, just log warning if early
        await processShiftAccrual(employeeId, sched.shift_salary, comment)

    } catch (e) {
        console.error("Auto Salary Error", e)
    }
}
