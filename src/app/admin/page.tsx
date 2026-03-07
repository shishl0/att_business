import AdminDashboard from '@/components/AdminDashboard'
import { getEmployees, getLogs, getSchedules } from '@/app/actions'

export const dynamic = 'force-dynamic'

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function AdminPage(props: Props) {
  const searchParams = await props.searchParams
  const tab = typeof searchParams.tab === 'string' ? searchParams.tab : 'employees'
  const employees = await getEmployees()
  const logs = await getLogs()
  const schedules = await getSchedules()
  
  return <AdminDashboard initialTab={tab as any} initialEmployees={employees} initialLogs={logs} initialSchedules={schedules} />
}
