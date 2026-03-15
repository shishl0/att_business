export type Employee = {
    id: string
    name: string
    device_id: string | null
    is_active: boolean
    balance: number
    created_at: string
}

export type Log = {
    id: string
    employee_id: string
    type: string
    timestamp: string
    ip_address: string
    comment?: string
    employees?: { name: string }
}

export type Schedule = {
    id: string
    employee_id: string
    day_of_week: number
    start_time: string
    end_time: string
    shift_salary: number
    employees?: { name: string }
}

export type Transaction = {
    id: string
    employee_id: string
    amount: number
    type: 'accrual' | 'withdrawal'
    timestamp: string
    source?: string
    comment?: string
}

export type Shift = {
    id: string
    employee_id: string
    employee_name: string
    date: string
    check_in_time: string | null
    check_out_time: string | null
    duration_ms: number
    is_overtime: boolean
    is_late: boolean
}

export type TabKey = 'employees' | 'schedule' | 'calendar' | 'logs' | 'finances' | 'settings'
