import { Loader2, Fingerprint } from 'lucide-react'

type Employee = { id: string; name: string; balance?: number; device_id?: string | null; is_active?: boolean; created_at?: string }

type DeviceLinkerProps = {
    unlinked: Employee[]
    selectedEmployeeId: string
    setSelectedEmployeeId: (id: string) => void
    onLink: () => Promise<void>
    isLinking: boolean
}

export default function DeviceLinker({
    unlinked,
    selectedEmployeeId,
    setSelectedEmployeeId,
    onLink,
    isLinking
}: DeviceLinkerProps) {
    return (
        <div className="w-full space-y-5 flex flex-col items-center">
            <div className="bg-orange-50/80 p-5 rounded-2xl w-full border border-orange-100/50">
                <h2 className="text-[15px] font-bold text-orange-900 text-center mb-1.5 flex items-center justify-center gap-2">
                    <Fingerprint className="w-4 h-4 text-orange-600" />
                    Устройство не привязано
                </h2>
                <p className="text-[13px] text-orange-700/80 text-center leading-relaxed font-medium">
                    Выберите себя из списка, чтобы закрепить телефон за вами.
                </p>
            </div>

            {unlinked.length > 0 ? (
                <div className="w-full space-y-4 pt-2">
                    <div className="relative">
                        <select
                            className="w-full p-4 bg-gray-50/50 border border-gray-200 text-gray-900 font-medium text-sm rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none pr-10 hover:bg-gray-50 cursor-pointer shadow-sm"
                            value={selectedEmployeeId}
                            onChange={(e) => setSelectedEmployeeId(e.target.value)}
                        >
                            <option value="" disabled>Выберите свое имя...</option>
                            {unlinked.map(u => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                            <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" /></svg>
                        </div>
                    </div>

                    <button
                        onClick={onLink}
                        disabled={!selectedEmployeeId || isLinking}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl font-bold shadow-xl shadow-blue-600/20 transition-all disabled:opacity-60 flex justify-center items-center h-[56px] disabled:hover:bg-blue-600"
                    >
                        {isLinking ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Подтвердить привязку'}
                    </button>
                </div>
            ) : (
                <div className="p-5 bg-gray-50 border border-gray-100 rounded-2xl w-full">
                    <p className="text-sm font-medium text-center text-gray-500">
                        Нет доступных сотрудников. Обратитесь к администратору.
                    </p>
                </div>
            )}
        </div>
    )
}
