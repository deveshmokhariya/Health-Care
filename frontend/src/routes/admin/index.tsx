import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MagneticButton } from '../../components/MagneticButton'
import { AnimatedCounter } from '../../components/AnimatedCounter'

export const Route = createFileRoute('/admin/')({
  component: AdminDashboard,
})

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } }
}
const ROW_ANIMATION = {
  hidden: { opacity: 0, x: -10 },
  show: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 30 } }
}

function AdminDashboard() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('doctors') // doctors, patients, slots, leaves, notifications
  const [doctors, setDoctors] = useState([])
  const [patients, setPatients] = useState([])
  const [appointments, setAppointments] = useState([])
  const [notifications, setNotifications] = useState([])
  const [leaves, setLeaves] = useState([])

  const [editDoc, setEditDoc] = useState<any>(null)
  const [editPat, setEditPat] = useState<any>(null)
  const [leaveDoc, setLeaveDoc] = useState<any>(null)
  const [leaveDate, setLeaveDate] = useState('')
  const [isRetrying, setIsRetrying] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
    
    const intervalId = setInterval(() => {
        fetchData()
    }, 30000)
    
    const onFocus = () => {
        fetchData()
    }
    window.addEventListener('focus', onFocus)
    
    return () => {
        clearInterval(intervalId)
        window.removeEventListener('focus', onFocus)
    }
  }, [])

  const fetchData = async () => {
    const opts = { credentials: 'include' as RequestCredentials }
    try {
        const [docs, pats, appts, notifs, lvs] = await Promise.all([
            fetch('http://localhost:8000/api/v1/admin/doctors', opts).then(r=>r.ok ? r.json() : []),
            fetch('http://localhost:8000/api/v1/admin/patients', opts).then(r=>r.ok ? r.json() : []),
            fetch('http://localhost:8000/api/v1/admin/appointments', opts).then(r=>r.ok ? r.json() : []),
            fetch('http://localhost:8000/api/v1/admin/notifications', opts).then(r=>r.ok ? r.json() : []),
            fetch('http://localhost:8000/api/v1/admin/leaves', opts).then(r=>r.ok ? r.json() : []),
        ])
        setDoctors(Array.isArray(docs) ? docs : [])
        setPatients(Array.isArray(pats) ? pats : [])
        setAppointments(Array.isArray(appts) ? appts : [])
        setNotifications(Array.isArray(notifs) ? notifs : [])
        setLeaves(Array.isArray(lvs) ? lvs : [])
    } catch(e) { console.error(e) }
  }

  const handleDeleteDoctor = async (id: string) => {
    if(!confirm('Are you sure you want to permanently delete this doctor? This will delete all their appointments.')) return;
    try {
        await fetch(`http://localhost:8000/api/v1/admin/doctors/${id}?hard_delete=true`, { method: 'DELETE', credentials: 'include' })
        fetchData()
    } catch(e: any) { alert(e.message) }
  }

  const handleDeletePatient = async (id: string) => {
      if(!confirm('Are you sure you want to permanently delete this patient? This will delete all their appointments.')) return;
      try {
          await fetch(`http://localhost:8000/api/v1/admin/patients/${id}?hard_delete=true`, { method: 'DELETE', credentials: 'include' })
          fetchData()
      } catch(e: any) { alert(e.message) }
  }

  const handleTogglePatientStatus = async (pat: any) => {
      try {
          await fetch(`http://localhost:8000/api/v1/admin/patients/${pat.id}/status`, { 
              method: 'PUT', headers: {'Content-Type': 'application/json'}, credentials: 'include',
              body: JSON.stringify({ is_active: !pat.is_active })
          })
          fetchData()
      } catch(e: any) { alert(e.message) }
  }

  const handleUpdateDoctor = async (e: any) => {
      e.preventDefault()
      try {
          await fetch(`http://localhost:8000/api/v1/admin/doctors/${editDoc.id}`, {
              method: 'PUT', headers: {'Content-Type': 'application/json'}, credentials: 'include',
              body: JSON.stringify(editDoc)
          })
          setEditDoc(null)
          fetchData()
      } catch(err: any) { alert(err.message) }
  }

  const handleUpdatePatient = async (e: any) => {
      e.preventDefault()
      try {
          await fetch(`http://localhost:8000/api/v1/admin/patients/${editPat.id}`, {
              method: 'PUT', headers: {'Content-Type': 'application/json'}, credentials: 'include',
              body: JSON.stringify(editPat)
          })
          setEditPat(null)
          fetchData()
      } catch(err: any) { alert(err.message) }
  }

  const handleMarkLeave = async (e: any) => {
      e.preventDefault()
      try {
          await fetch(`http://localhost:8000/api/v1/admin/doctors/${leaveDoc.id}/leave`, {
              method: 'POST', headers: {'Content-Type': 'application/json'}, credentials: 'include',
              body: JSON.stringify({ leave_date: leaveDate })
          })
          setLeaveDoc(null)
          fetchData()
      } catch(err: any) { alert(err.message) }
  }

  const handleCancelAppointment = async (id: string) => {
      if(!confirm('Cancel this appointment?')) return;
      try {
          await fetch(`http://localhost:8000/api/v1/admin/appointments/${id}/cancel`, { method: 'POST', credentials: 'include' })
          fetchData()
      } catch(e: any) { alert(e.message) }
  }

  const handleRetryNotification = async (id: string) => {
      setIsRetrying(id)
      try {
          await fetch(`http://localhost:8000/api/v1/admin/notifications/${id}/retry`, { method: 'POST', credentials: 'include' })
          await fetchData()
      } catch(e: any) { alert(e.message) }
      finally { setIsRetrying(null) }
  }

  const SidePanel = ({ children, onClose, title }: any) => (
      <AnimatePresence>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-end z-50 overflow-hidden">
              <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="bg-white h-full w-full max-w-md p-8 shadow-2xl flex flex-col relative overflow-y-auto">
                  <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 bg-gray-50 p-2 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                  <h3 className="font-extrabold text-2xl text-gray-900 mb-8">{title}</h3>
                  {children}
              </motion.div>
          </motion.div>
      </AnimatePresence>
  )

  const activeDocCount = doctors.length;
  const pendingNotifCount = Array.isArray(notifications) ? notifications.filter((n: any) => n.status === 'pending' || n.status === 'failed').length : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </div>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">System Admin</h1>
        </div>
        <MagneticButton onClick={() => navigate({ to: '/' })} className="text-sm font-semibold text-gray-500 hover:text-gray-800 bg-white border border-gray-200 px-4 py-2 rounded-lg transition-colors">Log Out</MagneticButton>
      </motion.div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md">
            <h3 className="text-gray-500 font-bold mb-1">Total Doctors</h3>
            <div className="text-5xl font-extrabold text-slate-900"><AnimatedCounter value={activeDocCount} /></div>
        </div>
        <div className="bg-rose-50 p-6 rounded-2xl border border-rose-100 shadow-inner">
            <h3 className="text-rose-600 font-bold mb-1">Failed/Pending Notifications</h3>
            <div className="text-5xl font-extrabold text-rose-900"><AnimatedCounter value={pendingNotifCount} /></div>
        </div>
      </motion.div>

      <div className="flex gap-4 mb-6 border-b border-gray-200 overflow-x-auto pb-2">
        {['doctors', 'patients', 'slots', 'leaves', 'notifications'].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`font-bold pb-2 px-1 relative transition-colors whitespace-nowrap capitalize ${tab === t ? 'text-slate-900' : 'text-gray-400 hover:text-gray-700'}`}>
                {t}
                {tab === t && <motion.div layoutId="adminTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800" />}
            </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {tab === 'doctors' && (
                  <div className="bg-white shadow-md rounded-2xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-gray-100"><tr className="text-sm text-gray-500 uppercase tracking-widest"><th className="p-5 font-bold">Doctor Info</th><th className="p-5 font-bold">Specialisation</th><th className="p-5 text-right font-bold">Actions</th></tr></thead>
                          <motion.tbody variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="divide-y divide-gray-100">
                              {doctors.map((doc: any) => (
                                  <motion.tr variants={ROW_ANIMATION} key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-5">
                                          <div className="font-extrabold text-slate-900">{doc.full_name}</div>
                                          <div className="text-gray-500 text-sm font-medium">{doc.email}</div>
                                      </td>
                                      <td className="p-5 font-semibold text-slate-700">{doc.specialisation || 'General'}</td>
                                      <td className="p-5 text-right space-x-3">
                                          <button onClick={() => setLeaveDoc(doc)} className="text-slate-600 text-sm hover:text-slate-900 font-bold bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm">Leave</button>
                                          <button onClick={() => setEditDoc(doc)} className="text-blue-600 text-sm hover:text-blue-900 font-bold bg-blue-50 px-3 py-1.5 rounded-lg">Edit</button>
                                          <button onClick={() => handleDeleteDoctor(doc.id)} className="text-rose-600 text-sm hover:text-rose-900 font-bold bg-rose-50 px-3 py-1.5 rounded-lg">Delete</button>
                                      </td>
                                  </motion.tr>
                              ))}
                          </motion.tbody>
                      </table>
                  </div>
              )}

              {tab === 'patients' && (
                  <div className="bg-white shadow-md rounded-2xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-gray-100"><tr className="text-sm text-gray-500 uppercase tracking-widest"><th className="p-5 font-bold">Patient Info</th><th className="p-5 font-bold">Status</th><th className="p-5 text-right font-bold">Actions</th></tr></thead>
                          <motion.tbody variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="divide-y divide-gray-100">
                              {patients.map((pat: any) => (
                                  <motion.tr variants={ROW_ANIMATION} key={pat.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-5">
                                          <div className="font-extrabold text-slate-900">{pat.full_name}</div>
                                          <div className="text-gray-500 text-sm font-medium">{pat.email}</div>
                                      </td>
                                      <td className="p-5"><span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${pat.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{pat.is_active ? 'Active' : 'Inactive'}</span></td>
                                      <td className="p-5 text-right space-x-3">
                                          <button onClick={() => setEditPat(pat)} className="text-blue-600 text-sm hover:text-blue-900 font-bold bg-blue-50 px-3 py-1.5 rounded-lg">Edit</button>
                                          <button onClick={() => handleTogglePatientStatus(pat)} className="text-amber-600 text-sm hover:text-amber-900 font-bold bg-amber-50 px-3 py-1.5 rounded-lg">{pat.is_active ? 'Deactivate' : 'Activate'}</button>
                                          <button onClick={() => handleDeletePatient(pat.id)} className="text-rose-600 text-sm hover:text-rose-900 font-bold bg-rose-50 px-3 py-1.5 rounded-lg">Delete</button>
                                      </td>
                                  </motion.tr>
                              ))}
                          </motion.tbody>
                      </table>
                  </div>
              )}

              {tab === 'notifications' && (
                  <div className="space-y-4">
                      <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="grid grid-cols-1 gap-4">
                          {notifications.map((n: any) => (
                              <motion.div variants={ROW_ANIMATION} key={n.id} className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-slate-300 transition-colors">
                                  <div className="flex gap-4 items-start">
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${n.status === 'sent' ? 'bg-emerald-50 text-emerald-600' : n.status === 'failed' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}`}>
                                          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                                      </div>
                                      <div>
                                          <p className="font-extrabold text-slate-900 text-lg">{n.type}</p>
                                          <p className="text-sm font-medium text-gray-500 mt-1">To: {n.recipient_email}</p>
                                          {n.error_message && <p className="text-xs text-rose-500 mt-2 font-medium bg-rose-50 px-2 py-1 rounded inline-block">{n.error_message}</p>}
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-3 w-full sm:w-auto">
                                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${n.status === 'sent' ? 'bg-emerald-100 text-emerald-800' : n.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>{n.status}</span>
                                      {(n.status === 'failed' || n.status === 'pending') && (
                                          <MagneticButton onClick={() => handleRetryNotification(n.id)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-slate-800 flex items-center justify-center min-w-[100px]">
                                              {isRetrying === n.id ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : 'Retry Now'}
                                          </MagneticButton>
                                      )}
                                  </div>
                              </motion.div>
                          ))}
                      </motion.div>
                  </div>
              )}

              {tab === 'slots' && (
                  <div className="bg-white shadow-md rounded-2xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-gray-100"><tr className="text-sm text-gray-500 uppercase tracking-widest"><th className="p-5 font-bold">Slot Time</th><th className="p-5 font-bold">Status</th><th className="p-5 text-right font-bold">Actions</th></tr></thead>
                          <motion.tbody variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="divide-y divide-gray-100">
                              {appointments.map((appt: any) => (
                                  <motion.tr variants={ROW_ANIMATION} key={appt.id} className="hover:bg-slate-50/50 transition-colors">
                                      <td className="p-5 font-extrabold text-slate-900">{new Date(appt.slot_start).toLocaleString()}</td>
                                      <td className="p-5"><span className="uppercase text-xs font-bold tracking-wider px-2 py-1 bg-gray-100 rounded-md text-gray-700">{appt.status}</span></td>
                                      <td className="p-5 text-right">
                                          {appt.status !== 'cancelled' && <button onClick={() => handleCancelAppointment(appt.id)} className="text-rose-600 text-sm hover:text-rose-900 font-bold bg-rose-50 px-3 py-1.5 rounded-lg">Cancel</button>}
                                      </td>
                                  </motion.tr>
                              ))}
                          </motion.tbody>
                      </table>
                  </div>
              )}
              {tab === 'leaves' && (
                  <div className="bg-white shadow-md rounded-2xl border border-gray-200 overflow-hidden">
                      <table className="w-full text-left">
                          <thead className="bg-slate-50 border-b border-gray-100"><tr className="text-sm text-gray-500 uppercase tracking-widest"><th className="p-5 font-bold">Doctor</th><th className="p-5 font-bold">Leave Date</th></tr></thead>
                          <motion.tbody variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="divide-y divide-gray-100">
                              {leaves.map((l: any, i) => (
                                  <motion.tr variants={ROW_ANIMATION} key={i} className="hover:bg-slate-50/50 transition-colors border-l-4 border-l-transparent hover:border-l-amber-400">
                                      <td className="p-5 font-extrabold text-slate-900">{l.doctor?.full_name || l.doctor_id}</td>
                                      <td className="p-5 font-semibold text-slate-700">{l.leave_date}</td>
                                  </motion.tr>
                              ))}
                          </motion.tbody>
                      </table>
                  </div>
              )}
          </motion.div>
      </AnimatePresence>

      {editDoc && (
          <SidePanel onClose={() => setEditDoc(null)} title="Edit Doctor">
              <form onSubmit={handleUpdateDoctor} className="space-y-6 flex-1">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                    <input type="email" value={editDoc.email} onChange={e => setEditDoc({...editDoc, email: e.target.value})} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-slate-500 outline-none transition-colors font-medium text-gray-800 bg-gray-50/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">New Password (blank to keep)</label>
                    <input type="text" placeholder="Enter new password" value={editDoc.password || ''} onChange={e => setEditDoc({...editDoc, password: e.target.value})} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-slate-500 outline-none transition-colors font-medium text-gray-800 bg-gray-50/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Specialisation</label>
                    <input type="text" value={editDoc.specialisation} onChange={e => setEditDoc({...editDoc, specialisation: e.target.value})} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-slate-500 outline-none transition-colors font-medium text-gray-800 bg-gray-50/50" />
                  </div>
                  <div className="pt-4 mt-auto">
                      <MagneticButton type="submit" strength={10} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 shadow-lg transition-all">Save Changes</MagneticButton>
                  </div>
              </form>
          </SidePanel>
      )}

      {editPat && (
          <SidePanel onClose={() => setEditPat(null)} title="Edit Patient">
              <form onSubmit={handleUpdatePatient} className="space-y-6 flex-1">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                    <input type="text" value={editPat.full_name} onChange={e => setEditPat({...editPat, full_name: e.target.value})} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-slate-500 outline-none transition-colors font-medium text-gray-800 bg-gray-50/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                    <input type="email" value={editPat.email} onChange={e => setEditPat({...editPat, email: e.target.value})} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-slate-500 outline-none transition-colors font-medium text-gray-800 bg-gray-50/50" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">New Password (blank to keep)</label>
                    <input type="text" placeholder="Enter new password" value={editPat.password || ''} onChange={e => setEditPat({...editPat, password: e.target.value})} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-slate-500 outline-none transition-colors font-medium text-gray-800 bg-gray-50/50" />
                  </div>
                  <div className="pt-4 mt-auto">
                      <MagneticButton type="submit" strength={10} className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 shadow-lg transition-all">Save Changes</MagneticButton>
                  </div>
              </form>
          </SidePanel>
      )}

      {leaveDoc && (
          <SidePanel onClose={() => setLeaveDoc(null)} title={`Mark Leave: ${leaveDoc.full_name}`}>
              <form onSubmit={handleMarkLeave} className="space-y-6 flex-1">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Date</label>
                    <input type="date" required value={leaveDate} onChange={e => setLeaveDate(e.target.value)} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-slate-500 outline-none transition-colors font-medium text-gray-800 bg-gray-50/50" />
                  </div>
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                    <p className="text-amber-800 text-sm font-medium">Marking leave will block this date from being booked. Any existing appointments must be manually cancelled.</p>
                  </div>
                  <div className="pt-4 mt-auto">
                      <MagneticButton type="submit" strength={10} className="w-full py-4 bg-rose-600 text-white rounded-xl font-bold text-lg hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all">Mark as Leave</MagneticButton>
                  </div>
              </form>
          </SidePanel>
      )}
    </div>
  )
}
