import AdminDashboard from '@/components/AdminDashboard'
import { getEmployees, getLogs } from '@/app/actions'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const employees = await getEmployees()
  const logs = await getLogs()
  
  return <AdminDashboard initialEmployees={employees} initialLogs={logs} />
}
