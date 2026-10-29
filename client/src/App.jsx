import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Staff from './pages/Staff.jsx';
import Roster from './pages/Roster.jsx';
import Attendance from './pages/Attendance.jsx';
import Payroll from './pages/Payroll.jsx';
import Leave from './pages/Leave.jsx';
import Account from './pages/Account.jsx';
import Audit from './pages/Audit.jsx';
import MyPayslips from './pages/MyPayslips.jsx';

const ALL = ['admin', 'manager', 'staff'];
const NAV = [
  { to: '/', label: 'Dashboard', roles: ALL, El: Dashboard },
  { to: '/staff', label: 'Staff', roles: ['admin', 'manager'], El: Staff },
  { to: '/roster', label: 'Roster', roles: ALL, El: Roster },
  { to: '/attendance', label: 'Attendance', roles: ALL, El: Attendance },
  { to: '/leave', label: 'Leave', roles: ALL, El: Leave },
  { to: '/payroll', label: 'Payroll', roles: ['admin'], El: Payroll },
  { to: '/payslips', label: 'My payslips', roles: ALL, El: MyPayslips },
  { to: '/audit', label: 'Audit log', roles: ['admin'], El: Audit },
  { to: '/account', label: 'Account', roles: ALL, El: Account },
];

export default function App() {
  const { ready, session, me, error, recovering, signOut } = useAuth();
  if (!ready) return <p className="center">Loading…</p>;
  if (!session) return <Login />;
  if (recovering) return <Account recovery />;
  if (error) return <div className="center"><p className="err">{error}</p><button onClick={signOut}>Sign out</button></div>;
  if (!me) return <p className="center">Loading…</p>;

  const items = NAV.filter((n) => n.roles.includes(me.role) && (n.to !== '/payslips' || me.staffId));
  return (
    <div className="shell">
      <nav>
        <b>Staff Manager</b>
        {items.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'}>{n.label}</NavLink>)}
        <span className="grow" />
        <small>{me.email} · {me.role}</small>
        <button className="ghost" onClick={signOut}>Sign out</button>
      </nav>
      <main>
        <Routes>
          {items.map(({ to, El }) => <Route key={to} path={to} element={<El />} />)}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
    </div>
  );
}
