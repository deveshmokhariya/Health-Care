import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MagneticButton } from '../../components/MagneticButton'
import { AnimatedCounter } from '../../components/AnimatedCounter'
import ReactMarkdown from 'react-markdown'

export const Route = createFileRoute('/doctor/')({
  component: DoctorDashboard,
})

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const FADE_UP_ITEM = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

function DoctorDashboard() {
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [expandedApptId, setExpandedApptId] = useState<string | null>(null)

  useEffect(() => {
    fetchAppointments()
    fetchProfile()
    
    const intervalId = setInterval(() => {
        fetchAppointments()
    }, 30000)
    
    const onFocus = () => {
        fetchAppointments()
    }
    window.addEventListener('focus', onFocus)
    
    return () => {
        clearInterval(intervalId)
        window.removeEventListener('focus', onFocus)
    }
  }, [])

  const fetchAppointments = async () => {
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1/doctor/appointments/today', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setAppointments(data)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchProfile = async () => {
      try {
          const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1/doctor/profile', { credentials: 'include' })
          if(res.ok) setProfile(await res.json())
      } catch(e) {}
  }

  const handleUpdateProfile = async (e: any) => {
      e.preventDefault()
      try {
          const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:8000') + '/api/v1/doctor/profile', {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              credentials: 'include',
              body: JSON.stringify({
                  working_hours_start: profile.working_hours_start,
                  working_hours_end: profile.working_hours_end,
                  slot_duration_minutes: profile.slot_duration_minutes
              })
          })
          if (!res.ok) throw new Error("Failed to update profile")
          setShowSettings(false)
      } catch(err: any) {
          alert(err.message)
      }
  }

  const upcomingCount = appointments.filter(a => a.status === 'confirmed').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/></svg>
            </div>
            <h1 className="text-3xl font-extrabold text-indigo-900 tracking-tight">Doctor Portal</h1>
        </div>
        <div className="flex items-center gap-4">
            <MagneticButton onClick={() => setShowSettings(true)} className="text-sm font-semibold text-indigo-700 bg-indigo-50 px-4 py-2 rounded-lg hover:bg-indigo-100 transition-colors">Manage Slots & Hours</MagneticButton>
            <MagneticButton onClick={() => navigate({ to: '/' })} className="text-sm font-semibold text-gray-500 hover:text-gray-800 bg-white border border-gray-200 px-4 py-2 rounded-lg transition-colors">Log Out</MagneticButton>
        </div>
      </motion.div>

      <AnimatePresence>
      {showSettings && profile && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-indigo-900/40 backdrop-blur-sm flex items-center justify-end p-0 z-50 overflow-hidden"
          >
              <motion.div 
                initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="bg-white h-full w-full max-w-md p-8 shadow-2xl flex flex-col relative"
              >
                  <button onClick={() => setShowSettings(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-800 bg-gray-50 p-2 rounded-full transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                  <h3 className="font-extrabold text-2xl text-gray-900 mb-2">Slot Management</h3>
                  <p className="text-gray-500 font-medium mb-8 leading-relaxed">Update your working hours to automatically generate daily appointment slots.</p>
                  
                  <form onSubmit={handleUpdateProfile} className="space-y-6 flex-1">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Start Time (Generate Slots From)</label>
                        <input type="time" value={profile.working_hours_start ? profile.working_hours_start.substring(0, 5) : ''} onChange={e => setProfile({...profile, working_hours_start: e.target.value.length === 5 ? e.target.value + ':00' : e.target.value})} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-indigo-500 outline-none transition-colors font-medium text-gray-800 shadow-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">End Time (Generate Slots Until)</label>
                        <input type="time" value={profile.working_hours_end ? profile.working_hours_end.substring(0, 5) : ''} onChange={e => setProfile({...profile, working_hours_end: e.target.value.length === 5 ? e.target.value + ':00' : e.target.value})} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-indigo-500 outline-none transition-colors font-medium text-gray-800 shadow-sm" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-gray-700">Slot Duration (Minutes)</label>
                        <input type="number" min="10" max="120" step="5" value={profile.slot_duration_minutes} onChange={e => setProfile({...profile, slot_duration_minutes: parseInt(e.target.value)})} className="w-full border-2 border-gray-200 px-4 py-3 rounded-xl focus:ring-0 focus:border-indigo-500 outline-none transition-colors font-medium text-gray-800 shadow-sm" />
                      </div>

                      <div className="pt-8">
                          <MagneticButton type="submit" strength={10} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-200 shadow-lg shadow-indigo-600/20 transition-all">Save Changes</MagneticButton>
                      </div>
                  </form>
              </motion.div>
          </motion.div>
      )}
      </AnimatePresence>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-2 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-md">
            <h3 className="text-gray-500 font-bold mb-1">Upcoming Today</h3>
            <div className="text-5xl font-extrabold text-indigo-900"><AnimatedCounter value={upcomingCount} /></div>
        </div>
        <div className="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 shadow-inner">
            <h3 className="text-indigo-600 font-bold mb-1">Completed</h3>
            <div className="text-5xl font-extrabold text-indigo-900"><AnimatedCounter value={completedCount} /></div>
        </div>
      </motion.div>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">Today's Schedule</h2>
      
      {appointments.length === 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-12 rounded-2xl text-center text-gray-500 border border-gray-200 shadow-sm flex flex-col items-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 text-gray-300"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span className="font-bold text-lg">No appointments scheduled for today.</span>
        </motion.div>
      )}

      <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-4">
        {appointments.map((appt: any) => {
          const isExpanded = expandedApptId === appt.id;
          return (
            <motion.div 
              layout
              variants={FADE_UP_ITEM}
              key={appt.id} 
              onMouseEnter={() => setExpandedApptId(appt.id)}
              onMouseLeave={() => setExpandedApptId(null)}
              className="border border-gray-200 rounded-2xl overflow-hidden shadow-sm bg-white transition-all hover:shadow-lg hover:border-indigo-200 cursor-default"
            >
              <motion.div layout className="p-6 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex flex-col items-center justify-center text-indigo-700 shrink-0 border border-indigo-100">
                        <span className="text-xs font-bold uppercase">{new Date(appt.slot_start).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                        <span className="text-sm font-extrabold leading-none mt-1">{new Date(appt.slot_start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div>
                    <p className="font-extrabold text-xl text-gray-900 tracking-tight">{appt.patient?.full_name || 'Patient'}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${appt.status === 'confirmed' ? 'bg-indigo-100 text-indigo-800' : appt.status === 'completed' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-800'}`}>
                            {appt.status}
                        </span>
                        {appt.symptom_form && appt.status === 'confirmed' && (
                            <span className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${appt.symptom_form.llm_urgency_level === 'high' ? 'bg-red-100 text-red-800 border border-red-200 animate-pulse' : appt.symptom_form.llm_urgency_level === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                                Urgency: {appt.symptom_form.llm_urgency_level}
                            </span>
                        )}
                    </div>
                    </div>
                </div>
                
                {appt.status === 'confirmed' && (
                  <MagneticButton 
                    onClick={() => navigate({ to: `/doctor/visit/${appt.id}` })}
                    className="bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 font-bold shadow-md shadow-indigo-600/20 shrink-0"
                  >
                    Start Visit
                  </MagneticButton>
                )}
                {appt.status === 'completed' && (
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      Completed
                  </span>
                )}
              </motion.div>

              <AnimatePresence>
                  {isExpanded && appt.symptom_form && appt.status === 'confirmed' && (
                      <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-6 pb-6 pt-2 overflow-hidden border-t border-gray-50 bg-gray-50/50"
                      >
                          <h4 className="font-bold text-xs uppercase tracking-widest text-indigo-400 mb-2 flex items-center gap-1">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                              Pre-Visit Triage Preview
                          </h4>
                          <div className="text-sm font-medium text-gray-700 leading-relaxed prose prose-sm prose-indigo max-w-none prose-p:my-1 prose-headings:mb-2 prose-ul:my-1">
                              <ReactMarkdown>{appt.symptom_form.llm_summary}</ReactMarkdown>
                          </div>
                      </motion.div>
                  )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
