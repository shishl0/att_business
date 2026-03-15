import { NextResponse } from 'next/server'
import { autoCloseOpenShifts } from '@/actions/attendance'

// This route can be called by a cron job (e.g., Vercel Cron, GitHub Actions, UptimeRobot)
// to automatically close shifts that have been open for too long.
// Optionally protect with a secret token via query param:  /api/auto-checkout?token=secret
export async function POST(request: Request) {
    const result = await autoCloseOpenShifts()
    return NextResponse.json(result)
}

export async function GET(request: Request) {
    const result = await autoCloseOpenShifts()
    return NextResponse.json(result)
}
