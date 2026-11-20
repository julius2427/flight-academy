import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { IconChart, IconClipboard, IconCone, IconHome, IconLayers, IconUsers } from './Icons'

const links = [
  { to: '/app', label: 'Home', icon: <IconHome />, end: true },
  { to: '/app/sessions', label: 'Sessions', icon: <IconClipboard /> },
  { to: '/app/athletes', label: 'Athletes', icon: <IconUsers /> },
  { to: '/app/reports', label: 'Reports', icon: <IconChart /> },
  { to: '/app/exercises', label: 'Exercises', icon: <IconCone /> },
  { to: '/app/drills', label: 'Drills', icon: <IconLayers /> },
]

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  return (
    <>
      <header className="topbar">
        <div className="container">
          <NavLink to="/app" className="brand">
            <img src="./logo.png" alt="" />
            <span>Flight Academy</span>
          </NavLink>
          <nav className="nav" aria-label="Main">
            {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end}>{l.label}</NavLink>)}
            {isAdmin && <NavLink to="/app/coaches">Coaches</NavLink>}
          </nav>
          <div className="user">
            {isAdmin && <NavLink to="/app/coaches" className="btn btn-sm hide-desktop">Coaches</NavLink>}
            <button className="btn btn-sm" onClick={signOut} title={profile?.email ?? ''}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="main">
        <div className="container"><Outlet /></div>
      </main>
      <nav className="tabbar" aria-label="Main">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}>{l.icon}<span>{l.label}</span></NavLink>
        ))}
      </nav>
    </>
  )
}
