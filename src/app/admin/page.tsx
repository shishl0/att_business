import AdminDashboard from '@/components/AdminDashboard'
import { getAdminDashboardData } from '@/actions/admin'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AdminPage(props: Props) {
  const searchParams = await props.searchParams
  const tab = typeof searchParams.tab === 'string' ? searchParams.tab : 'employees'

  const data = await getAdminDashboardData()

  return <AdminDashboard
    initialTab={tab as any}
    initialEmployees={data.employees || []}
    initialLogs={data.logs || []}
    initialSchedules={data.schedules || []}
    initialTransactions={data.transactions || []}
    initialAllowedIps={data.allowed_ips || '.*'}
    initialLateGraceMins={data.late_grace_mins || '15'}
    initialLatePenaltyKzt={data.late_penalty_kzt || '1000'}
  />
}
