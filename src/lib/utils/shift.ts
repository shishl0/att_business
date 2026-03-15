import { Log, Schedule, Shift } from '@/types'

export function createShift(inLog: Log | null, outLog: Log | null, schedulesForDay: Schedule[] = [], lateGraceMins: number = 15): Shift {
    const baseLog = inLog || outLog!
    const empId = baseLog.employee_id
    const empName = baseLog.employees?.name || 'Неизвестно'

    const inTime = inLog ? new Date(inLog.timestamp) : null
    const outTime = outLog ? new Date(outLog.timestamp) : null

    const refDate = inTime || outTime!

    // Format to standard YYYY-MM-DD for simpler calendar math
    const year = refDate.getFullYear()
    const month = String(refDate.getMonth() + 1).padStart(2, '0')
    const day = String(refDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}` // ISO-like for grouping

    let duration_ms = 0
    let is_overtime = false
    let is_late = false

    if (inTime && outTime) {
        duration_ms = outTime.getTime() - inTime.getTime()
        const hours = duration_ms / (1000 * 60 * 60)

        // GMT+5 Offset
        const offsetMs = 5 * 60 * 60 * 1000
        const localEndTime = new Date(outTime.getTime() + offsetMs)
        const endHour = localEndTime.getUTCHours()

        if (hours > 13 || endHour >= 22 || endHour < 9) {
            is_overtime = true
        }
    }

    if (inTime && schedulesForDay.length > 0) {
        // Check if they were late based on the first schedule of that day
        const firstSchedule = schedulesForDay.sort((a, b) => a.start_time.localeCompare(b.start_time))[0]
        const [schedHour, schedMin] = firstSchedule.start_time.split(':').map(Number)

        // Convert inTime to local for comparison
        const offsetMs = 5 * 60 * 60 * 1000
        const localInTime = new Date(inTime.getTime() + offsetMs)
        const inHour = localInTime.getUTCHours()
        const inMin = localInTime.getUTCMinutes()

        const schedTotalMinutes = schedHour * 60 + schedMin
        const inTotalMinutes = inHour * 60 + inMin

        // Only mark as late if they checked in more than `lateGraceMins` minutes AFTER the scheduled start time
        if (inTotalMinutes > schedTotalMinutes + lateGraceMins) {
            is_late = true
        }
    }

    return {
        id: `shift_${baseLog.id}`,
        employee_id: empId,
        employee_name: empName,
        date: dateStr,
        check_in_time: inLog ? inLog.timestamp : null,
        check_out_time: outLog ? outLog.timestamp : null,
        duration_ms,
        is_overtime,
        is_late
    }
}

export function computeShifts(logs: Log[], schedules: Schedule[], lateGraceMins: number = 15): Shift[] {
    const reversed = [...logs].reverse()
    const shifts: Shift[] = []
    const openShifts: Record<string, Log> = {}

    reversed.forEach(log => {
        const logDate = new Date(log.timestamp)
        const dayOfWeek = logDate.getDay() || 7 // 1 (Mon) - 7 (Sun)
        const empSchedules = schedules.filter(s => s.employee_id === log.employee_id && s.day_of_week === dayOfWeek)

        if (log.type === 'check_in') {
            openShifts[log.employee_id] = log
        } else if (log.type === 'check_out') {
            const inLog = openShifts[log.employee_id]
            if (inLog) {
                shifts.push(createShift(inLog, log, empSchedules, lateGraceMins))
                delete openShifts[log.employee_id]
            } else {
                shifts.push(createShift(null, log, empSchedules, lateGraceMins))
            }
        }
    })

    // Add remaining open shifts
    Object.values(openShifts).forEach(inLog => {
        const logDate = new Date(inLog.timestamp)
        const dayOfWeek = logDate.getDay() || 7
        const empSchedules = schedules.filter(s => s.employee_id === inLog.employee_id && s.day_of_week === dayOfWeek)
        shifts.push(createShift(inLog, null, empSchedules, lateGraceMins))
    })

    return shifts
}
