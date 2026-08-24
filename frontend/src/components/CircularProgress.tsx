import { motion } from 'framer-motion';

interface CircularProgressProps {
  progress: number; // 0 to 100
  timeString: string;
}

export function CircularProgress({ progress, timeString }: CircularProgressProps) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center w-14 h-14">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 48 48">
        {/* Background Track */}
        <circle
          className="text-amber-100"
          strokeWidth="4"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="24"
          cy="24"
        />
        {/* Animated Progress */}
        <motion.circle
          className="text-amber-500"
          strokeWidth="4"
          strokeDasharray={circumference}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx="24"
          cy="24"
          strokeLinecap="round"
          animate={{ strokeDashoffset }}
          transition={{ ease: 'linear', duration: 1 }} // smoothly animate to each second
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold text-amber-700">{timeString}</span>
      </div>
    </div>
  );
}
