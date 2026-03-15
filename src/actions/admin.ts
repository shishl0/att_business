'use server'

import { getEmployees } from './employees'
import { getLogs } from './attendance'
import { getSchedules } from './schedule'
import { getTransactions } from './finance'
import { getSetting } from './settings'

export async function getAdminDashboardData() {
    const [employees, logs, schedules, transactions, ipSetting, graceMins, penaltyKzt] = await Promise.all([
        getEmployees(),
        getLogs(),
        getSchedules(),
        getTransactions(),
        getSetting('allowed_ips'),
        getSetting('late_grace_mins'),
        getSetting('late_penalty_kzt')
    ])
    return {
        success: true,
        employees,
        logs,
        schedules,
        transactions,
        allowed_ips: ipSetting || '.*',
        late_grace_mins: graceMins || '15',
        late_penalty_kzt: penaltyKzt || '1000'
    }
}
