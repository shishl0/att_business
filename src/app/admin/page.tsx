import AdminDashboard from '@/components/AdminDashboard'
import { getAdminDashboardData } from '@/app/actions'

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
  />
}
