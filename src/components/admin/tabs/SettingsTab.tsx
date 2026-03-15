'use client'

import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { getAdminIpSubnet } from '@/actions/settings'

type SettingsTabProps = {
    currentAllowedIps: string
    currentLateGraceMins: string
    currentLatePenalty: string
    onSave: (newIps: string, newGrace: string, newPenalty: string) => Promise<boolean>
}

export default function SettingsTab({
    currentAllowedIps,
    currentLateGraceMins,
    currentLatePenalty,
    onSave
}: SettingsTabProps) {
    const [ipInput, setIpInput] = useState(currentAllowedIps)
    const [lateGraceMins, setLateGraceMins] = useState(currentLateGraceMins)
    const [latePenaltyKzt, setLatePenaltyKzt] = useState(currentLatePenalty)
    const [isRefreshing, setIsRefreshing] = useState(false)

    useEffect(() => {
        setIpInput(currentAllowedIps)
        setLateGraceMins(currentLateGraceMins)
        setLatePenaltyKzt(currentLatePenalty)
    }, [currentAllowedIps, currentLateGraceMins, currentLatePenalty])

    const handleSaveSettings = async () => {
        setIsRefreshing(true)
        await onSave(ipInput, lateGraceMins, latePenaltyKzt)
        setIsRefreshing(false)
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" />
                Настройки Системы
            </h2>
            <div className="space-y-6">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <label className="block text-sm font-bold text-blue-900 mb-2">Разрешенные IP адреса (RegEx)</label>
                    <p className="text-xs text-blue-700/70 mb-4">Настройте регулярное выражение для проверки IP-адресов сотрудников при отметке. По умолчанию `.*` разрешает все сети.</p>
                    <div className="flex gap-3 items-center">
                        <Input
                            value={ipInput}
                            onChange={e => setIpInput(e.target.value)}
                            placeholder="Например: ^5\.76\.\d{1,3}\.\d{1,3}$"
                            className="font-mono bg-white flex-1"
                        />
                        <Button
                            onClick={async () => {
                                setIsRefreshing(true)
                                const subnet = await getAdminIpSubnet()
                                setIpInput(subnet)
                                setIsRefreshing(false)
                                toast.success('Подсеть определена')
                            }}
                            variant="outline"
                            className="flex-none bg-white text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                            disabled={isRefreshing}
                        >
                            Моя подсеть
                        </Button>
                        <Button onClick={handleSaveSettings} disabled={isRefreshing} className="flex-none bg-blue-600 hover:bg-blue-700">
                            Сохранить
                        </Button>
                    </div>
                </div>

                <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                    <label className="block text-sm font-bold text-rose-900 mb-2">Штрафы за опоздание</label>
                    <p className="text-xs text-rose-700/70 mb-4">Настройте допустимое время опоздания и сумму штрафа (списывается автоматически).</p>
                    <div className="flex gap-4 items-center">
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-rose-800 mb-1 block">Допустимое опоздание (мин)</label>
                            <Input
                                type="number"
                                value={lateGraceMins}
                                onChange={e => setLateGraceMins(e.target.value)}
                                className="font-mono bg-white"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-semibold text-rose-800 mb-1 block">Сумма штрафа (тг)</label>
                            <Input
                                type="number"
                                value={latePenaltyKzt}
                                onChange={e => setLatePenaltyKzt(e.target.value)}
                                className="font-mono bg-white"
                            />
                        </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                        <Button onClick={handleSaveSettings} variant="destructive" disabled={isRefreshing}>
                            Обновить штрафы
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
