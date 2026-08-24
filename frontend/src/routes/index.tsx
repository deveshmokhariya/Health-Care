import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { MagneticButton } from '../components/MagneticButton'
import heroImg from '../assets/hero-illustration.jpg'

export const Route = createFileRoute('/')({
  component: AuthPage,
})

const STAGGER = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
}

const FADE_UP = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 20 } }
}

function AuthPage() {
  const navigate = useNavigate()
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('admin@clinic.com')
  const [password, setPassword] = useState('admin1234')
  const [role, setRole] = useState('admin') // admin, patient, doctor
  const [fullName, setFullName] = useState('System Admin')
  const [error, setError] = useState('')

  // Parallax tracking
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  
  const springConfig = { damping: 30, stiffness: 100, mass: 1 }
  const xSpring = useSpring(mouseX, springConfig)
  const ySpring = useSpring(mouseY, springConfig)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window
      // Max displacement 20px
      const xObj = ((e.clientX / innerWidth) - 0.5) * -40 
      const yObj = ((e.clientY / innerHeight) - 0.5) * -40
      mouseX.set(xObj)
      mouseY.set(yObj)
    }

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const isTouch = window.matchMedia('(pointer: coarse)').matches

    if (!isReducedMotion && !isTouch) {
      window.addEventListener('mousemove', handleMouseMove)
    }

    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const endpoint = isLogin ? '/api/v1/auth/login' : '/api/v1/auth/register'
    const body = isLogin 
        ? { email, password } 
        : { email, password, full_name: fullName, role }

    try {
        const res = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || 'http://localhost:8000') + ''}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(body)
        })
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            let errMsg = "Authentication failed"
            if (errData.detail) {
                errMsg = typeof errData.detail === 'string' ? errData.detail : JSON.stringify(errData.detail)
            }
            throw new Error(errMsg)
        }
        
        const data = await res.json()
        if (data.user.role === 'admin') navigate({ to: '/admin' })
        else if (data.user.role === 'patient') navigate({ to: '/patient' })
        else navigate({ to: '/doctor' })
        
    } catch (err: any) {
        setError(err.message)
    }
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-base font-sans relative overflow-hidden">
      {/* Background Animated Gradient Mesh */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden opacity-30">
        <motion.div 
          className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-teal-200/50 blur-[120px]"
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ repeat: Infinity, duration: 15, ease: "linear" }}
        />
        <motion.div 
          className="absolute top-[40%] right-[10%] w-[40%] h-[50%] rounded-full bg-indigo-200/30 blur-[120px]"
          animate={{ x: [0, -40, 0], y: [0, -40, 0] }}
          transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        />
      </div>

      {/* Left Side - Hero Image & Parallax */}
      <div className="hidden md:flex flex-col justify-center w-1/2 p-12 border-r border-teal-100 relative z-10 overflow-hidden">
        
        {/* Parallax Layer */}
        <motion.div 
          className="absolute inset-0 flex items-center justify-center p-12"
          style={{ x: xSpring, y: ySpring }}
        >
          <div className="w-full h-full rounded-2xl overflow-hidden relative shadow-2xl bg-teal-900 border-4 border-white/40">
            <motion.div 
              className="absolute inset-0 bg-gradient-to-tr from-teal-900/60 to-transparent z-10"
            />
            <motion.img 
              src={heroImg}
              alt="Healthcare Innovation" 
              className="w-full h-full object-cover mix-blend-overlay opacity-90"
              animate={{ scale: [1, 1.1] }}
              transition={{ duration: 30, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
            />
            {/* Branding integrated over the image layer for parallax coherence */}
            <div className="absolute bottom-12 left-12 z-20 text-white space-y-4 pr-12">
               <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white text-xl font-bold border border-white/30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/></svg>
                </div>
                <span className="text-3xl font-bold tracking-tight">CareConnect</span>
              </div>
              <h1 className="text-4xl lg:text-5xl font-extrabold leading-tight text-white drop-shadow-md">
                Modern Healthcare, <br/>Simplified.
              </h1>
              <p className="text-lg text-teal-50 drop-shadow-sm font-medium">
                Book appointments, share symptoms in advance, and receive AI-powered clinical summaries seamlessly.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex items-center justify-center w-full md:w-1/2 p-8 z-10 relative">
        <motion.div 
          initial="initial"
          animate="animate"
          variants={STAGGER}
          className="w-full max-w-md bg-white/80 backdrop-blur-xl p-10 rounded-2xl shadow-xl border border-white/50"
        >
            <div className="md:hidden flex items-center gap-3 mb-8 justify-center">
              <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/></svg>
              </div>
              <span className="text-xl font-bold text-teal-900">CareConnect</span>
            </div>

            <motion.h2 variants={FADE_UP} className="text-3xl font-bold text-gray-900 mb-2 tracking-tight">
                {isLogin ? "Welcome Back" : "Create Account"}
            </motion.h2>
            <motion.p variants={FADE_UP} className="text-gray-500 mb-8 font-medium">
                {isLogin ? "Please enter your details to sign in." : "Sign up for a secure patient account."}
            </motion.p>
            
            <div className="min-h-[64px] mb-2">
                {error && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg flex items-start gap-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        <p className="text-sm font-medium">{error}</p>
                    </motion.div>
                )}
            </div>

            <motion.form variants={STAGGER} onSubmit={handleSubmit} className="space-y-6">
                {!isLogin && (
                    <>
                        <motion.div variants={FADE_UP} className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">Full Name</label>
                            <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} required className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-sm bg-white/70 backdrop-blur-md" placeholder="Jane Doe" />
                        </motion.div>
                        <motion.div variants={FADE_UP} className="space-y-2">
                            <label className="block text-sm font-semibold text-gray-700">Role</label>
                            <select value={role} onChange={e=>setRole(e.target.value)} className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-sm bg-white/70 backdrop-blur-md">
                                <option value="patient">Patient</option>
                                <option value="doctor">Doctor</option>
                                <option value="admin">Admin</option>
                            </select>
                        </motion.div>
                    </>
                )}
                <motion.div variants={FADE_UP} className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Email Address</label>
                    <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-sm bg-white/70 backdrop-blur-md" placeholder="you@example.com" />
                </motion.div>
                <motion.div variants={FADE_UP} className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">Password</label>
                    <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} className="w-full border border-gray-300 px-4 py-3 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all shadow-sm bg-white/70 backdrop-blur-md" placeholder="••••••••" />
                </motion.div>
                
                <motion.div variants={FADE_UP} className="pt-2">
                  <MagneticButton 
                    type="submit" 
                    strength={15}
                    className="w-full bg-teal-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-teal-700 focus:ring-4 focus:ring-teal-200 focus:outline-none transition-colors shadow-lg shadow-teal-600/20 flex justify-center items-center gap-2"
                  >
                      {isLogin ? "Sign In" : "Register"}
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </MagneticButton>
                </motion.div>
            </motion.form>

            <motion.div variants={FADE_UP} className="mt-8 pt-6 border-t border-gray-100 text-center">
                <p className="text-sm text-gray-600 font-medium">
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-teal-600 font-bold hover:text-teal-700 focus:outline-none focus:underline transition-colors px-2 py-1 rounded-md hover:bg-teal-50">
                        {isLogin ? "Create one now" : "Sign in instead"}
                    </button>
                </p>
            </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
