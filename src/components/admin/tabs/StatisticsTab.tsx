'use client'

import { useState, useMemo } from 'react'
import { CalendarIcon, Clock, Users, TrendingUp, Wallet, HandCoins, AlertTriangle, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Employee, Log, Transaction } from '@/types'
import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, Cell, Legend, PieChart, Pie 
} from 'recharts'

type StatisticsTabProps = {
    employees: Employee[]
    logs: Log[]
    transactions: Transaction[]
}

export default function StatisticsTab({ employees, logs, transactions }: StatisticsTabProps) {
    const today = new Date().toISOString().split('T')[0]
    const defaultStart = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
    
    const [startDate, setStartDate] = useState(defaultStart)
    const [endDate, setEndDate] = useState(today)

    const stats = useMemo(() => {
        const start = new Date(startDate)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)

        // Filter logs and transactions by date range
        const filteredLogs = logs.filter(l => {
            const d = new Date(l.timestamp)
            return d >= start && d <= end
        })

        const filteredTransactions = transactions.filter(t => {
            const d = new Date(t.timestamp)
            return d >= start && d <= end
        })

        // Helper to get all dates in range
        const getDatesInRange = (startDate: string, endDate: string) => {
            const dates = []
            let curr = new Date(startDate)
            const last = new Date(endDate)
            while (curr <= last) {
                dates.push(curr.toISOString().split('T')[0])
                curr.setDate(curr.getDate() + 1)
            }
            return dates
        }

        const dateRange = getDatesInRange(startDate, endDate)

        // Group logs by day and employee
        const logsByDay: Record<string, Record<string, { in?: string, out?: string }>> = {}
        filteredLogs.forEach(log => {
            const date = log.timestamp.split('T')[0]
            if (!logsByDay[date]) logsByDay[date] = {}
            if (!logsByDay[date][log.employee_id]) logsByDay[date][log.employee_id] = {}
            
            if (log.type === 'check_in' && (!logsByDay[date][log.employee_id].in || log.timestamp < logsByDay[date][log.employee_id].in!)) {
                logsByDay[date][log.employee_id].in = log.timestamp
            }
            if (log.type === 'check_out' && (!logsByDay[date][log.employee_id].out || log.timestamp > logsByDay[date][log.employee_id].out!)) {
                logsByDay[date][log.employee_id].out = log.timestamp
            }
        })

        const checkInTimes: number[] = []
        const checkOutTimes: number[] = []

        Object.values(logsByDay).forEach(emps => {
            Object.values(emps).forEach(times => {
                if (times.in) {
                    const date = new Date(times.in)
                    checkInTimes.push(date.getHours() * 60 + date.getMinutes())
                }
                if (times.out) {
                    const date = new Date(times.out)
                    checkOutTimes.push(date.getHours() * 60 + date.getMinutes())
                }
            })
        })

        // Lateness
        const latenessTransactions = filteredTransactions.filter(t => t.source === 'system' && t.comment?.includes('Штраф за опоздание'))
        const totalLatenessCount = latenessTransactions.length

        // Financials
        const totalAccrued = filteredTransactions.filter(t => t.type === 'accrual').reduce((sum, t) => sum + t.amount, 0)
        const totalAdvances = filteredTransactions.filter(t => t.type === 'withdrawal' && t.source !== 'system').reduce((sum, t) => sum + Math.abs(t.amount), 0)

        // Employee Salaries
        const activeEmployees = employees.filter(e => e.is_active !== false)
        const salaries = activeEmployees.map(e => e.balance).filter(b => b > 10) // Filter out tiny/empty balances
        const avgSalary = salaries.length > 0 ? salaries.reduce((sum, b) => sum + b, 0) / salaries.length : 0
        
        const sortedSalaries = [...salaries].sort((a, b) => a - b)
        const medianSalary = sortedSalaries.length > 0 
            ? (sortedSalaries.length % 2 === 0 
                ? (sortedSalaries[Math.floor(sortedSalaries.length/2) - 1] + sortedSalaries[Math.floor(sortedSalaries.length/2)]) / 2
                : sortedSalaries[Math.floor(sortedSalaries.length/2)])
            : 0

        const formatTime = (totalMins: number) => {
            if (isNaN(totalMins)) return '--:--'
            const h = Math.floor(totalMins / 60)
            const m = Math.round(totalMins % 60)
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        }

        const avgIn = checkInTimes.length > 0 ? checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length : NaN
        const avgOut = checkOutTimes.length > 0 ? checkOutTimes.reduce((a, b) => a + b, 0) / checkOutTimes.length : NaN

        // Aggregated chart data for every day in range
        const chartData = dateRange.map(date => {
            const dayLogs = logsByDay[date] || {}
            const attendanceCount = Object.keys(dayLogs).length
            const dayAccrued = filteredTransactions
                .filter(t => t.timestamp.startsWith(date) && t.type === 'accrual')
                .reduce((sum, t) => sum + t.amount, 0)
            const dayAdvances = filteredTransactions
                .filter(t => t.timestamp.startsWith(date) && t.type === 'withdrawal' && t.source !== 'system')
                .reduce((sum, t) => sum + Math.abs(t.amount), 0)

            return {
                date: new Date(date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' }),
                fullDate: date,
                amount: dayAccrued,
                advances: dayAdvances,
                attendance: attendanceCount
            }
        })

        return {
            avgArrival: formatTime(avgIn),
            avgDeparture: formatTime(avgOut),
            totalLateness: totalLatenessCount,
            totalAccrued,
            totalAdvances,
            employeeCount: employees.length,
            activeEmployeeCount: activeEmployees.length,
            avgSalary,
            medianSalary,
            chartData
        }
    }, [startDate, endDate, logs, transactions, employees])

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Range Selector */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 w-full sm:w-auto">
                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                    <Input 
                        type="date" 
                        value={startDate} 
                        onChange={(e) => {
                            const val = e.target.value
                            if (val && !isNaN(new Date(val).getTime())) setStartDate(val)
                        }} 
                        className="border-none bg-transparent h-8 p-0 focus-visible:ring-0 text-sm font-bold w-full"
                    />
                </div>
                <div className="text-gray-300 hidden sm:block">/</div>
                <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100 w-full sm:w-auto">
                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                    <Input 
                        type="date" 
                        value={endDate} 
                        onChange={(e) => {
                            const val = e.target.value
                            if (val && !isNaN(new Date(val).getTime())) setEndDate(val)
                        }} 
                        className="border-none bg-transparent h-8 p-0 focus-visible:ring-0 text-sm font-bold w-full"
                    />
                </div>
                <div className="ml-auto text-xs font-medium text-gray-400">
                    Период: {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Средний приход" value={stats.avgArrival} icon={Clock} color="emerald" />
                <StatCard title="Средний уход" value={stats.avgDeparture} icon={LogOutIcon} color="blue" />
                <StatCard title="Опозданий" value={stats.totalLateness.toString()} icon={AlertTriangle} color="rose" />
                <StatCard title="Начислено ЗП" value={`${stats.totalAccrued.toLocaleString()} ₸`} icon={Wallet} color="sky" />
                <StatCard title="Выдано авансов" value={`${stats.totalAdvances.toLocaleString()} ₸`} icon={HandCoins} color="orange" />
                <StatCard title="Сотрудников" value={stats.activeEmployeeCount.toString()} icon={Users} color="indigo" />
                <StatCard title="Средняя ЗП" value={`${Math.round(stats.avgSalary).toLocaleString()} ₸`} icon={TrendingUp} color="violet" />
                <StatCard title="Медиана ЗП" value={`${Math.round(stats.medianSalary).toLocaleString()} ₸`} icon={BarChart3} color="fuchsia" />
            </div>

            {/* Recharts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
                {/* Main Trend Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[400px]">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Динамика начислений
                    </h3>
                    <div className="flex-1 w-full relative min-h-[300px]">
                        <div className="absolute inset-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={stats.chartData}>
                                    <defs>
                                        <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} minTickGap={20} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [`${value.toLocaleString()} ₸`, 'Сумма']}
                                    />
                                    <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={3} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Attendance Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[400px]">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-500" /> Посещаемость (чел/день)
                    </h3>
                    <div className="flex-1 w-full relative min-h-[300px]">
                        <div className="absolute inset-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} minTickGap={20} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(value: any) => [value, 'Человек']}
                                    />
                                    <Bar dataKey="attendance" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Financial Distribution Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[400px]">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-violet-500" /> Соотношение выплат
                    </h3>
                    <div className="flex-1 w-full relative min-h-[300px] flex items-center justify-center">
                        <div className="absolute inset-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Чистые начисления', value: stats.totalAccrued },
                                            { name: 'Выдано авансов', value: stats.totalAdvances }
                                        ]}
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        <Cell fill="#8b5cf6" />
                                        <Cell fill="#f59e0b" />
                                    </Pie>
                                    <Tooltip formatter={(value: any) => `${value.toLocaleString()} ₸`} />
                                    <Legend verticalAlign="bottom" height={36}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Compare Bar Chart */}
                <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col min-h-[400px]">
                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" /> Начисления vs Авансы
                    </h3>
                    <div className="flex-1 w-full relative min-h-[300px]">
                        <div className="absolute inset-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} minTickGap={20} />
                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                                    <Tooltip formatter={(value: any) => `${value.toLocaleString()} ₸`} />
                                    <Legend verticalAlign="top" align="right" />
                                    <Bar dataKey="amount" name="Начисления" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="advances" name="Авансы" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function StatCard({ title, value, icon: Icon, color }: { title: string, value: string, icon: any, color: string }) {
    const colorClasses: Record<string, string> = {
        emerald: 'bg-emerald-50 text-emerald-600',
        blue: 'bg-blue-50 text-blue-600',
        rose: 'bg-rose-50 text-rose-600',
        sky: 'bg-sky-50 text-sky-600',
        orange: 'bg-orange-50 text-orange-600',
        indigo: 'bg-indigo-50 text-indigo-600',
        violet: 'bg-violet-50 text-violet-600',
        fuchsia: 'bg-fuchsia-50 text-fuchsia-600',
    }

    return (
        <div className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-8 h-8 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-3`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</div>
            <div className="text-lg font-black text-gray-900 leading-tight">{value}</div>
        </div>
    )
}

function LogOutIcon(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
        </svg>
    )
}
