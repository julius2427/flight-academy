import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Cover from './pages/Cover'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Pending from './pages/Pending'
import Dashboard from './pages/Dashboard'
import Athletes from './pages/Athletes'
import AthleteForm from './pages/AthleteForm'
import AthleteDetail from './pages/AthleteDetail'
import Exercises from './pages/Exercises'
import ExerciseForm from './pages/ExerciseForm'
import Drills from './pages/Drills'
import DrillForm from './pages/DrillForm'
import Sessions from './pages/Sessions'
import SessionSetup from './pages/SessionSetup'
import SessionScore from './pages/SessionScore'
import Coaches from './pages/Coaches'
import Reports from './pages/Reports'
import { AllGrowthReports, AthleteGrowthReport } from './pages/GrowthReports'

function RequireStaff({ admin = false }: { admin?: boolean }) {
  const { session, loading, isStaff, isAdmin } = useAuth()
  if (loading) return <div className="spinner" aria-label="Loading" />
  if (!session) return <Navigate to="/login" replace />
  if (!isStaff) return <Pending />
  if (admin && !isAdmin) return <Navigate to="/app" replace />
  return <Layout />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Cover />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/app" element={<RequireStaff />}>
        <Route index element={<Dashboard />} />
        <Route path="athletes" element={<Athletes />} />
        <Route path="athletes/new" element={<AthleteForm />} />
        <Route path="athletes/:id" element={<AthleteDetail />} />
        <Route path="athletes/:id/edit" element={<AthleteForm />} />
        <Route path="exercises" element={<Exercises />} />
        <Route path="exercises/new" element={<ExerciseForm />} />
        <Route path="exercises/:id" element={<ExerciseForm />} />
        <Route path="drills" element={<Drills />} />
        <Route path="drills/new" element={<DrillForm />} />
        <Route path="drills/:id" element={<DrillForm />} />
        <Route path="sessions" element={<Sessions />} />
        <Route path="sessions/new" element={<SessionSetup />} />
        <Route path="sessions/:id" element={<SessionScore />} />
        <Route path="sessions/:id/setup" element={<SessionSetup />} />
        <Route path="reports" element={<Reports />} />
        <Route path="reports/athletes" element={<AllGrowthReports />} />
        <Route path="athletes/:id/report" element={<AthleteGrowthReport />} />
      </Route>
      <Route path="/app/coaches" element={<RequireStaff admin />}>
        <Route index element={<Coaches />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
