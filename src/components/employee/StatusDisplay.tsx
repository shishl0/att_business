type Employee = { id: string; name: string; balance?: number; device_id?: string | null; is_active?: boolean; created_at?: string }
type Schedule = { id?: string; employee_id?: string; day_of_week?: number; start_time: string; end_time: string; shift_salary: number }

type StatusDisplayProps = {
    employee: Employee
    todaySchedule: Schedule | null
}

export default function StatusDisplay({ employee, todaySchedule }: StatusDisplayProps) {
    return (
        <div className="text-center bg-gray-50/80 px-8 py-5 rounded-3xl border border-gray-100 w-full shadow-sm">
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Сотрудник</p>
            <h2 className="text-2xl font-extrabold text-gray-900 leading-tight mb-3">
                {employee.name}
            </h2>

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200/60 mt-2">
                <div className="text-center flex-1">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Баланс</p>
                    <p className={`text-base font-bold ${employee.balance && employee.balance < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {employee.balance || 0} ₸
                    </p>
                </div>
                {todaySchedule && (
                    <>
                        <div className="w-px h-8 bg-gray-200"></div>
                        <div className="text-center flex-1">
                            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-0.5">Ставка</p>
                            <p className="text-base font-bold text-blue-600">{todaySchedule.shift_salary || 0} ₸</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
