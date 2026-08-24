import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MagneticButton } from '../../../components/MagneticButton'
import ReactMarkdown from 'react-markdown'

export const Route = createFileRoute('/doctor/visit/$appointmentId')({
  component: VisitCompletion,
})

const STAGGER_CONTAINER = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const FADE_UP_ITEM = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

function VisitCompletion() {
  const { appointmentId } = Route.useParams()
  const navigate = useNavigate()
  
  const [appointment, setAppointment] = useState<any>(null)
  
  const [step, setStep] = useState(0)
  // Form fields
  const [notes, setNotes] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [prescriptions, setPrescriptions] = useState('')
  const [followUp, setFollowUp] = useState('')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0)

  const loadingMessages = [
    "Analyzing raw notes...",
    "Extracting clinical diagnosis...",
    "Structuring medication data...",
    "Generating patient-friendly summary..."
  ]

  useEffect(() => {
    fetch(`http://localhost:8000/api/v1/doctor/appointments/${appointmentId}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setAppointment(data))
      .catch(console.error)
  }, [appointmentId])

  useEffect(() => {
    let msgInterval: any;
    if (isSubmitting) {
      msgInterval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % loadingMessages.length)
      }, 2000)
    }
    return () => clearInterval(msgInterval)
  }, [isSubmitting, loadingMessages.length])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    // Concatenate all fields into raw_notes for the backend
    const rawNotes = `Notes: ${notes}\nDiagnosis: ${diagnosis}\nPrescriptions: ${prescriptions}\nFollow-up: ${followUp}`
    
    try {
      const res = await fetch(`http://localhost:8000/api/v1/doctor/appointments/${appointmentId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ raw_notes: rawNotes })
      })
      if (!res.ok) throw new Error("Failed to submit notes")
      const data = await res.json()
      setResult(data)
    } catch (e: any) {
      alert(e.message)
      setIsSubmitting(false)
    }
  }

  const steps = ["General Notes", "Diagnosis", "Prescriptions", "Follow Up"]

  if (result) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto font-sans bg-gray-50 min-h-screen">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-50 border-2 border-emerald-200 p-8 rounded-2xl mb-8 shadow-sm">
          <h2 className="text-3xl font-extrabold text-emerald-900 mb-2 flex items-center gap-3">
             <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
             AI Extraction Complete
          </h2>
          <p className="text-emerald-700 font-medium text-lg">The medical AI successfully processed your consultation notes and generated the patient summary and prescriptions.</p>
        </motion.div>
        
        <motion.div variants={STAGGER_CONTAINER} initial="hidden" animate="show" className="space-y-6">
            <motion.div variants={FADE_UP_ITEM} className="bg-white border border-indigo-100 p-8 rounded-2xl shadow-md">
              <h3 className="font-extrabold text-xl text-indigo-900 mb-4 flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                 Patient Summary
              </h3>
              <div className="bg-indigo-50/50 p-6 rounded-2xl text-indigo-950 font-medium prose prose-indigo max-w-none border border-indigo-100/50">
                  <ReactMarkdown>{result.visit_note.llm_patient_summary}</ReactMarkdown>
              </div>
            </motion.div>

            <motion.h3 variants={FADE_UP_ITEM} className="font-extrabold text-xl mb-4 text-gray-900 mt-10">Extracted Prescriptions</motion.h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
              {result.prescriptions.map((p: any) => (
                <motion.div variants={FADE_UP_ITEM} key={p.id} className="border-2 border-indigo-100 p-6 rounded-2xl bg-white shadow-sm hover:border-indigo-300 transition-colors">
                  <p className="font-extrabold text-indigo-900 text-xl mb-4">{p.medication_name}</p>
                  <div className="space-y-3 text-sm text-gray-600 font-medium">
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400">Dosage</span> <span className="text-gray-900">{p.dosage}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400">Frequency</span> <span className="text-gray-900">{p.frequency}</span></div>
                    <div className="flex justify-between border-b border-gray-50 pb-2"><span className="text-gray-400">Duration</span> <span className="text-gray-900">{p.duration_days} days</span></div>
                    {p.instructions && <div className="mt-3 pt-3 text-gray-500 italic">"{p.instructions}"</div>}
                  </div>
                </motion.div>
              ))}
            </div>
            
            <motion.div variants={FADE_UP_ITEM} className="flex justify-end">
                <MagneticButton onClick={() => navigate({ to: '/doctor' })} className="bg-gray-900 text-white px-8 py-4 rounded-xl hover:bg-gray-800 font-bold shadow-lg text-lg">
                  Return to Dashboard
                </MagneticButton>
            </motion.div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto font-sans bg-gray-50 min-h-screen">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
        <h1 className="text-3xl font-extrabold text-indigo-900 tracking-tight">Consultation</h1>
        <button onClick={() => navigate({ to: '/doctor' })} className="text-sm font-semibold text-gray-500 hover:text-indigo-600 bg-white border border-gray-200 px-4 py-2 rounded-lg transition-colors">Abort & Return</button>
      </motion.div>
      
      <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-1/3">
              {appointment?.symptom_form && (
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="bg-white border border-indigo-100 rounded-2xl p-6 shadow-md sticky top-8">
                  <div className="flex flex-col gap-4 mb-4">
                    <h2 className="text-sm font-extrabold uppercase tracking-widest text-indigo-400 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                      Pre-Visit Triage
                    </h2>
                    <span className={`inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider w-max ${appointment.symptom_form.llm_urgency_level === 'high' ? 'bg-red-100 text-red-800 border border-red-200' : appointment.symptom_form.llm_urgency_level === 'medium' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                      Urgency: {appointment.symptom_form.llm_urgency_level}
                    </span>
                  </div>
                  <div className="bg-indigo-50/50 p-5 rounded-2xl border border-indigo-50 text-indigo-950 font-medium text-sm prose prose-sm prose-indigo max-w-none shadow-inner">
                    <ReactMarkdown>{appointment.symptom_form.llm_summary}</ReactMarkdown>
                  </div>
                </motion.div>
              )}
          </div>

          <div className="w-full lg:w-2/3">
              {isSubmitting ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="bg-white border border-gray-200 p-12 rounded-2xl shadow-xl flex flex-col items-center justify-center py-24 text-center h-[500px]"
                  >
                      <div className="relative mb-8">
                        <motion.div className="w-20 h-20 border-4 border-indigo-100 rounded-full" />
                        <motion.div 
                          className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full absolute top-0 left-0"
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                        />
                      </div>
                      <AnimatePresence mode="wait">
                        <motion.h3 
                          key={loadingMsgIdx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.3 }}
                          className="text-2xl font-extrabold text-indigo-900"
                        >
                          {loadingMessages[loadingMsgIdx]}
                        </motion.h3>
                      </AnimatePresence>
                      <p className="text-gray-500 font-medium mt-4">Structuring medical data securely...</p>
                  </motion.div>
              ) : (
                  <div className="bg-white border border-gray-200 p-8 rounded-2xl shadow-xl overflow-hidden">
                      {/* Step Indicator */}
                      <div className="flex gap-2 mb-10">
                          {steps.map((s, i) => (
                              <div key={i} className="flex-1">
                                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mb-2 relative">
                                      {i <= step && (
                                          <motion.div 
                                              layoutId={`progress-${i}`}
                                              initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 0.4 }}
                                              className={`absolute top-0 left-0 bottom-0 ${i === step ? 'bg-indigo-500' : 'bg-indigo-300'}`} 
                                          />
                                      )}
                                  </div>
                                  <span className={`text-xs font-bold uppercase tracking-wider ${i === step ? 'text-indigo-600' : i < step ? 'text-indigo-400' : 'text-gray-400'}`}>{s}</span>
                              </div>
                          ))}
                      </div>

                      <AnimatePresence mode="wait">
                          <motion.div
                              key={step}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: -20 }}
                              transition={{ duration: 0.2 }}
                          >
                              {step === 0 && (
                                  <div className="space-y-4">
                                      <h3 className="font-extrabold text-2xl text-gray-900">General Notes</h3>
                                      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6} className="w-full border-2 border-gray-200 rounded-2xl p-5 focus:ring-0 focus:border-indigo-500 outline-none resize-y text-gray-800 text-lg bg-gray-50/50 hover:bg-white focus:bg-white transition-colors" placeholder="Patient presented with..." />
                                  </div>
                              )}
                              {step === 1 && (
                                  <div className="space-y-4">
                                      <h3 className="font-extrabold text-2xl text-gray-900">Diagnosis</h3>
                                      <textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} rows={6} className="w-full border-2 border-gray-200 rounded-2xl p-5 focus:ring-0 focus:border-indigo-500 outline-none resize-y text-gray-800 text-lg bg-gray-50/50 hover:bg-white focus:bg-white transition-colors" placeholder="Acute bronchitis..." />
                                  </div>
                              )}
                              {step === 2 && (
                                  <div className="space-y-4">
                                      <h3 className="font-extrabold text-2xl text-gray-900">Prescriptions</h3>
                                      <textarea value={prescriptions} onChange={e => setPrescriptions(e.target.value)} rows={6} className="w-full border-2 border-gray-200 rounded-2xl p-5 focus:ring-0 focus:border-indigo-500 outline-none resize-y text-gray-800 text-lg bg-gray-50/50 hover:bg-white focus:bg-white transition-colors" placeholder="Amoxicillin 500mg PO BID x 7 days..." />
                                  </div>
                              )}
                              {step === 3 && (
                                  <div className="space-y-4">
                                      <h3 className="font-extrabold text-2xl text-gray-900">Follow Up Plan</h3>
                                      <textarea value={followUp} onChange={e => setFollowUp(e.target.value)} rows={6} className="w-full border-2 border-gray-200 rounded-2xl p-5 focus:ring-0 focus:border-indigo-500 outline-none resize-y text-gray-800 text-lg bg-gray-50/50 hover:bg-white focus:bg-white transition-colors" placeholder="Return to clinic in 2 weeks if symptoms do not improve..." />
                                  </div>
                              )}
                          </motion.div>
                      </AnimatePresence>

                      <div className="flex justify-between items-center mt-10 pt-6 border-t border-gray-100">
                          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="px-6 py-3 font-bold text-gray-500 disabled:opacity-30 hover:bg-gray-50 rounded-xl transition-colors">
                              Back
                          </button>
                          
                          {step < steps.length - 1 ? (
                              <MagneticButton strength={15} onClick={() => setStep(step + 1)} className="bg-indigo-100 text-indigo-700 px-8 py-3 rounded-xl font-bold hover:bg-indigo-200 transition-colors flex items-center gap-2">
                                  Next Step
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
                              </MagneticButton>
                          ) : (
                              <MagneticButton strength={15} onClick={handleSubmit} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2">
                                  Complete Visit
                                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                              </MagneticButton>
                          )}
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  )
}
