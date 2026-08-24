import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CircularProgress } from '../../components/CircularProgress'
import { MagneticButton } from '../../components/MagneticButton'
import ReactMarkdown from 'react-markdown'

export const Route = createFileRoute('/patient/')({
  component: PatientPortal,
})

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

const FADE_UP_ITEM = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

function PatientPortal() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('search')
  const [doctors, setDoctors] = useState<any[]>([])
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null)
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split('T')[0])
  const [slots, setSlots] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [bookingStep, setBookingStep] = useState(0) // 0: select, 1: symptom form, 2: analyzing
  const [heldAppointment, setHeldAppointment] = useState<any>(null)
  const [symptoms, setSymptoms] = useState('')
  const [timeRemaining, setTimeRemaining] = useState(0)
  
  // Rotating LLM Loading Messages
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)
  const loadingMessages = [
    "Analyzing your symptoms...",
    "Assessing clinical urgency...",
    "Generating pre-visit triage summary...",
    "Securing your appointment slot..."
  ]

  useEffect(() => {
    if (activeTab === 'search') {
        fetchDoctors()
    }
    if (activeTab === 'appointments') {
        fetchAppointments()
        
        // 1. Polling: Auto-refresh every 30 seconds
        const intervalId = setInterval(() => {
            fetchAppointments()
        }, 30000)
        
        // 2. Window Focus: Refetch immediately when user switches back to the tab
        const onFocus = () => {
            fetchAppointments()
        }
        window.addEventListener('focus', onFocus)
        
        // Cleanup interval and listener on unmount or tab switch
        return () => {
            clearInterval(intervalId)
            window.removeEventListener('focus', onFocus)
        }
    }
  }, [activeTab])

  useEffect(() => {
    let interval: any;
    if ((bookingStep === 1 || bookingStep === 2) && heldAppointment) {
      const expiresAt = new Date(heldAppointment.expires_at).getTime()
      interval = setInterval(() => {
        const now = new Date().getTime()
        const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000))
        setTimeRemaining(remaining)
        if (remaining <= 0) {
          setBookingStep(0)
          setHeldAppointment(null)
          alert("Hold expired. Please select a slot again.")
        }
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [bookingStep, heldAppointment])

  useEffect(() => {
    let msgInterval: any;
    if (bookingStep === 2) {
      msgInterval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % loadingMessages.length)
      }, 2000)
    }
    return () => clearInterval(msgInterval)
  }, [bookingStep, loadingMessages.length])

  const fetchDoctors = async () => {
    const data = await fetch('http://localhost:8000/api/v1/patient/doctors', { credentials: 'include' }).then(r => r.json())
    if(Array.isArray(data)) setDoctors(data)
  }

    const fetchAppointments = async () => {
        try {
            const res = await fetch(`http://localhost:8000/api/v1/patient/appointments?t=${Date.now()}`, { 
                credentials: 'include',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            })
            if (!res.ok) {
                if (res.status === 403) {
                    alert("Access Denied: You are currently logged in as a Doctor or Admin. Please click 'Log Out' and log back in with your Patient account to see your appointments.")
                } else {
                    console.error("Failed to fetch appointments:", res.status, await res.text())
                }
                return
            }
            const data = await res.json()
            if(Array.isArray(data)) setAppointments(data)
        } catch (e) {
            console.error("Network error fetching appointments:", e)
        }
    }

  const handleSelectDoctor = async (doctorId: string) => {
    setSelectedDoctor(doctorId)
    try {
      const data = await fetch(`http://localhost:8000/api/v1/patient/doctors/${doctorId}/slots?target_date=${targetDate}`, { credentials: 'include' }).then(r => r.json())
      // The API returns an array of DoctorSearchResponse. We extract available_slots from the first item.
      if (Array.isArray(data) && data.length > 0) {
        setSlots(data[0].available_slots || [])
      } else {
        setSlots([])
      }
    } catch(e) {
      console.error(e)
      setSlots([])
    }
  }

  const handleHoldSlot = async (slotStart: string) => {
    if(!selectedDoctor) return;
    try {
        const res = await fetch('http://localhost:8000/api/v1/patient/appointments/hold', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ doctor_id: selectedDoctor, slot_start: slotStart })
        })
        if (!res.ok) throw new Error("Slot already taken or expired.")
        const data = await res.json()
        setHeldAppointment(data)
        setBookingStep(1)
    } catch (e: any) {
        alert(e.message)
    }
  }

  const handleConfirm = async () => {
    if(!heldAppointment) return;
    setBookingStep(2) // trigger skeleton loader
    try {
        const res = await fetch(`http://localhost:8000/api/v1/patient/appointments/${heldAppointment.appointment_id}/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ symptoms, duration_days: null, severity: null })
        })
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.detail ? JSON.stringify(errData.detail) : "Failed to confirm booking";
            throw new Error(errMsg);
        }
        setBookingStep(0)
        setHeldAppointment(null)
        setSymptoms('')
        setActiveTab('appointments')
    } catch (e: any) {
        alert(e.message)
        setBookingStep(1) // Revert on fail
    }
  }

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeString = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-7xl mx-auto font-sans bg-gray-50 min-h-screen">
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200"
      >
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/></svg>
            </div>
            <h1 className="text-3xl font-extrabold text-teal-900 tracking-tight">Patient Portal</h1>
        </div>
        <MagneticButton onClick={() => navigate({ to: '/' })} className="text-sm font-semibold text-teal-600 bg-teal-50 px-4 py-2 rounded-lg hover:bg-teal-100 transition-colors">
          Log Out
        </MagneticButton>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-6 mb-8 border-b border-gray-200 relative">
        <button 
            className={`font-semibold pb-3 px-1 transition-colors relative ${activeTab === 'search' ? 'text-teal-900' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('search')}
        >
            Book Appointment
            {activeTab === 'search' && (
              <motion.div layoutId="patientTabActive" className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600" />
            )}
        </button>
        <button 
            className={`font-semibold pb-3 px-1 transition-colors relative ${activeTab === 'appointments' ? 'text-teal-900' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('appointments')}
        >
            My Appointments
            {activeTab === 'appointments' && (
              <motion.div layoutId="patientTabActive" className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600" />
            )}
        </button>
      </motion.div>

      <AnimatePresence mode="wait">
      {activeTab === 'search' && (
        <motion.div 
          key="search"
          initial="hidden" 
          animate="show" 
          exit={{ opacity: 0, y: -20, transition: { duration: 0.15 } }}
          variants={STAGGER_CONTAINER} 
          className="space-y-8"
        >
            {bookingStep === 0 ? (
                <>
                    <motion.div variants={FADE_UP_ITEM} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <h2 className="text-2xl font-bold text-gray-900">1. Select a Doctor & Time</h2>
                        <input type="date" value={targetDate} onChange={e => {
                          const newDate = e.target.value;
                          setTargetDate(newDate);
                          if (selectedDoctor) {
                            // Re-fetch slots for the new date without clearing doctor selection
                            fetch(`http://localhost:8000/api/v1/patient/doctors/${selectedDoctor}/slots?target_date=${newDate}`, { credentials: 'include' })
                              .then(r => r.json())
                              .then(data => {
                                if (Array.isArray(data) && data.length > 0) setSlots(data[0].available_slots || [])
                                else setSlots([])
                              })
                              .catch(() => setSlots([]))
                          } else {
                            setSlots([])
                          }
                        }} className="border border-gray-300 px-4 py-2 rounded-lg font-medium text-gray-700 focus:ring-2 focus:ring-teal-500 focus:outline-none" />
                    </motion.div>
                    
                    <motion.div variants={STAGGER_CONTAINER} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {doctors.map(doc => (
                            <motion.div 
                                variants={FADE_UP_ITEM}
                                whileHover={{ y: -4, boxShadow: '0 12px 40px rgba(0,0,0,0.06)' }}
                                key={doc.id} 
                                className={`group border p-6 rounded-2xl transition-all cursor-default ${selectedDoctor === doc.id ? 'border-teal-500 ring-2 ring-teal-100 bg-teal-50/30 shadow-md' : 'border-gray-200 bg-white hover:border-teal-300'}`}
                            >
                                <div className="flex items-start gap-4 mb-5">
                                    <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl shrink-0 transition-all duration-300 ${selectedDoctor === doc.id ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30' : 'bg-teal-50 text-teal-600 group-hover:bg-teal-100'}`}>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-lg text-gray-900 leading-tight truncate">{doc.full_name}</h3>
                                        <p className="text-sm font-medium text-teal-700 flex items-center gap-1.5 mt-1 truncate">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                                            <span className="truncate">{doc.specialisation || 'General Practice'}</span>
                                        </p>
                                    </div>
                                </div>
                                <MagneticButton 
                                    strength={10}
                                    onClick={() => handleSelectDoctor(doc.id)} 
                                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${selectedDoctor === doc.id ? 'bg-teal-600 text-white shadow-md' : 'bg-gray-50 text-gray-700 hover:bg-teal-50 hover:text-teal-700'}`}
                                >
                                    {selectedDoctor === doc.id ? 'Viewing Slots' : 'View Slots'}
                                </MagneticButton>
                            </motion.div>
                        ))}
                    </motion.div>

                    {selectedDoctor && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }} 
                          animate={{ opacity: 1, height: 'auto' }} 
                          className="mt-8 bg-white p-8 rounded-2xl border border-gray-200 shadow-lg overflow-hidden"
                        >
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-teal-600"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                Available Slots for {targetDate}
                            </h3>
                            {slots.length === 0 && <p className="text-gray-500 italic">No slots available for this date.</p>}
                            <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="flex flex-wrap gap-3">
                                {slots.filter(s => s.is_available).map((slot, i) => (
                                    <motion.div key={i} variants={FADE_UP_ITEM}>
                                      <MagneticButton 
                                          onClick={() => handleHoldSlot(slot.slot_start)} 
                                          strength={20}
                                          className="border-2 border-teal-100 bg-white hover:bg-teal-600 hover:text-white hover:border-teal-600 text-teal-900 px-6 py-3 rounded-xl font-bold transition-colors focus:ring-4 focus:ring-teal-200 focus:outline-none"
                                      >
                                          {new Date(slot.slot_start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </MagneticButton>
                                    </motion.div>
                                ))}
                            </motion.div>
                        </motion.div>
                    )}
                </>
            ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  className="max-w-3xl mx-auto bg-white border border-gray-200 p-8 md:p-10 rounded-2xl shadow-xl relative overflow-hidden"
                >
                    {/* Decorative Background Blob */}
                    <div className="absolute -top-32 -right-32 w-64 h-64 bg-amber-50 rounded-full blur-3xl pointer-events-none opacity-60"></div>
                    
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-8 relative z-10">
                        <div>
                          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">2. Pre-Visit Triage</h2>
                          <p className="text-gray-600 font-medium max-w-md leading-relaxed">
                              Your slot is held. Please describe your symptoms below. Our AI will securely prepare a clinical summary for your doctor.
                          </p>
                        </div>
                        
                        {/* Smooth Circular Countdown Timer UI */}
                        <div className="flex flex-col items-center shrink-0">
                            <CircularProgress progress={(timeRemaining / 300) * 100} timeString={timeString} />
                        </div>
                    </div>
                    
                    {bookingStep === 1 ? (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-6 relative z-10"
                      >
                          <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">What brings you in today?</label>
                            <textarea 
                                className="w-full border-2 border-gray-200 p-5 rounded-2xl focus:ring-0 focus:border-teal-500 outline-none transition-colors resize-y text-gray-900 text-lg shadow-sm placeholder:text-gray-400 bg-gray-50/50 hover:bg-white focus:bg-white" 
                                rows={5} 
                                placeholder="E.g., I have had a severe headache and slight fever for 3 days..."
                                value={symptoms}
                                onChange={e => setSymptoms(e.target.value)}
                            />
                          </div>
                          
                          <div className="flex flex-col sm:flex-row gap-4 pt-4">
                              <MagneticButton 
                                onClick={handleConfirm} 
                                disabled={!symptoms.trim()} 
                                className="bg-teal-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-teal-700 focus:ring-4 focus:ring-teal-200 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-lg shadow-lg shadow-teal-600/20"
                              >
                                  Confirm Appointment
                                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                              </MagneticButton>
                              <button onClick={() => { setBookingStep(0); setHeldAppointment(null) }} className="text-gray-500 font-bold px-8 py-4 rounded-xl hover:bg-gray-100 transition-colors">
                                  Cancel & Go Back
                              </button>
                          </div>
                      </motion.div>
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="py-12 flex flex-col items-center justify-center space-y-6 z-10 relative"
                      >
                        <div className="relative">
                          <motion.div 
                            className="w-16 h-16 border-4 border-teal-100 rounded-full"
                          />
                          <motion.div 
                            className="w-16 h-16 border-4 border-teal-600 border-t-transparent rounded-full absolute top-0 left-0"
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          />
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.p 
                            key={loadingMsgIdx}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.3 }}
                            className="text-lg font-bold text-teal-800"
                          >
                            {loadingMessages[loadingMsgIdx]}
                          </motion.p>
                        </AnimatePresence>
                      </motion.div>
                    )}
                </motion.div>
            )}
        </motion.div>
      )}

      {activeTab === 'appointments' && (
                  <motion.div 
                    key="appointments"
                    initial="hidden"
                    animate="show"
                    exit={{ opacity: 0 }}
                    variants={STAGGER_CONTAINER}
                    className="space-y-6"
                  >
                      <div className="flex justify-between items-center mb-6">
                          <h2 className="text-2xl font-bold text-gray-900">Upcoming & Past Appointments</h2>
                          <button 
                              onClick={fetchAppointments}
                              className="text-sm font-bold bg-teal-50 text-teal-700 px-4 py-2 rounded-lg hover:bg-teal-100 transition-colors flex items-center gap-2"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                              Refresh
                          </button>
                      </div>
                      
                      {appointments.length === 0 && (
                <motion.div variants={FADE_UP_ITEM} className="text-center p-12 bg-white border border-gray-200 rounded-2xl text-gray-500 shadow-sm flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4 text-gray-300"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    <p className="text-lg font-bold">No appointments found.</p>
                </motion.div>
            )}
            {appointments.map(appt => (
                <motion.div 
                  variants={FADE_UP_ITEM}
                  whileHover={{ y: -4 }}
                  key={appt.id} 
                  className="border border-gray-200 p-8 rounded-2xl shadow-sm bg-white transition-shadow hover:shadow-lg"
                >
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-4">
                        <div className="flex items-start gap-5">
                            <div className="w-14 h-14 bg-teal-50 rounded-2xl flex flex-col items-center justify-center text-teal-700 shrink-0 border border-teal-100">
                                <span className="text-xs font-bold uppercase">{new Date(appt.slot_start).toLocaleDateString(undefined, {month: 'short'})}</span>
                                <span className="text-lg font-extrabold leading-none mt-0.5">{new Date(appt.slot_start).toLocaleDateString(undefined, {day: 'numeric'})}</span>
                            </div>
                            <div>
                                <p className="font-extrabold text-xl text-gray-900 tracking-tight">{new Date(appt.slot_start).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - Dr. {appt.doctor?.full_name || 'Unknown'}</p>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${appt.status === 'confirmed' ? 'bg-teal-100 text-teal-800' : appt.status === 'completed' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-800'}`}>
                                        {appt.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {appt.status === 'confirmed' && (
                            <MagneticButton className="text-red-600 bg-white border-2 border-red-100 px-5 py-2.5 rounded-xl hover:bg-red-50 hover:border-red-200 text-sm font-bold transition-all shrink-0">
                              Cancel Visit
                            </MagneticButton>
                        )}
                    </div>
                    
                    {/* SHOW SUBMITTED SYMPTOMS (HISTORY) ALWAYS IF AVAILABLE */}
                    {appt.symptom_form && (
                        <div className="mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">My Submitted Symptoms (History)</h4>
                            <p className="text-sm font-medium text-gray-800">{appt.symptom_form.symptoms}</p>
                        </div>
                    )}
                    
                    {appt.status === 'completed' && appt.visit_note && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="mt-8 border-t border-gray-100 pt-8"
                        >
                            <h3 className="font-bold text-teal-900 mb-4 flex items-center gap-2 text-sm tracking-widest uppercase">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
                                Post-Visit Summary
                            </h3>
                            <div className="bg-teal-50/70 p-6 rounded-2xl border border-teal-100/50 text-teal-950 text-base font-medium prose prose-teal max-w-none mb-8 shadow-inner">
                                <ReactMarkdown>{appt.visit_note.llm_patient_summary || '*No summary available.*'}</ReactMarkdown>
                            </div>
                            
                            {appt.visit_note.prescriptions && appt.visit_note.prescriptions.length > 0 && (
                                <>
                                    <h4 className="font-bold text-gray-900 mb-4 text-base tracking-tight flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400"><path d="M10 2v7.31"/><path d="M14 9.3V1.99"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/><path d="M6 20h12"/></svg>
                                      Prescribed Medications
                                    </h4>
                                    <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {appt.visit_note.prescriptions.map((p: any) => (
                                            <motion.div variants={FADE_UP_ITEM} key={p.id} className="bg-white border-2 border-gray-100 p-5 rounded-2xl text-sm hover:border-teal-200 transition-colors">
                                                <div className="font-extrabold text-teal-800 mb-2 text-lg">
                                                    {p.medication_name}
                                                </div>
                                                <div className="space-y-2 text-gray-600 font-medium">
                                                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400">Dosage</span> <span className="text-gray-900">{p.dosage}</span></div>
                                                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400">Freq</span> <span className="text-gray-900">{p.frequency}</span></div>
                                                    <div className="flex justify-between"><span className="text-gray-400">Duration</span> <span className="text-gray-900">{p.duration_days} days</span></div>
                                                    {p.instructions && <div className="mt-3 pt-3 border-t border-dashed border-gray-200 text-xs text-gray-500 italic">"{p.instructions}"</div>}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </motion.div>
                    )}
                </motion.div>
            ))}
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  )
}
