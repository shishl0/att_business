'use server'

import { supabase } from '@/lib/supabase'
import { headers } from 'next/headers'

export async function getSetting(key: string) {
    try {
        const { data } = await supabase.from('settings').select('value').eq('key', key).single()
        return data?.value || null
    } catch (e) {
        return null
    }
}

export async function updateSetting(key: string, value: string) {
    try {
        const { error } = await supabase.from('settings').upsert({ key, value })
        if (error) return { success: false, error: error.message }
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}

export async function getAdminIpSubnet() {
    const headersList = await headers()
    const rawIp = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || '127.0.0.1'
    let ip = rawIp.split(',')[0].trim()
    if (ip.startsWith('::ffff:')) ip = ip.substring(7)

    // Create subnet regex (first two octets)
    const parts = ip.split('.')
    if (parts.length === 4) {
        return `^${parts[0]}\\.${parts[1]}\\..*`
    }
    return '.*'
}
