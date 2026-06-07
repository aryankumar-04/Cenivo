import React from 'react';

interface CenivoIconProps {
  className?: string;
  glow?: boolean;
}

export function CenivoIcon({ className = "w-9 h-9", glow = true }: CenivoIconProps) {
  return (
    <div className={`relative shrink-0 ${className}`}>
      {/* Premium organic white ambient background glow matching Cenivo's cinematic highlights */}
      {glow && (
        <div className="absolute inset-0 bg-white/10 rounded-full blur-md opacity-35 scale-110 pointer-events-none" />
      )}
      
      {/* High-Fidelity SVG of the elegant, thin minimalist crescent "C" from the user reference */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 transition-transform duration-300 hover:scale-110"
      >
        {/* Curved-arc segment forming the perfect minimalist C */}
        <path
          d="M 75 25 A 35 35 0 1 0 75 75"
          stroke="#FFFFFF"
          strokeWidth="4.5"
          strokeLinecap="round"
          className="drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]"
        />
      </svg>
    </div>
  );
}

interface CenivoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  withText?: boolean;
  className?: string;
  glow?: boolean;
}

export default function CenivoLogo({ size = 'md', withText = true, className = '', glow = true }: CenivoLogoProps) {
  const iconSizeMap = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-20 h-20'
  };

  const textSizeMap = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-5xl'
  };

  const gapMap = {
    sm: 'gap-2',
    md: 'gap-3',
    lg: 'gap-4',
    xl: 'gap-5'
  };

  return (
    <div className={`flex items-center ${gapMap[size]} ${className}`}>
      {/* Interactive logo icon representation */}
      <CenivoIcon className={iconSizeMap[size]} glow={glow} />

      {/* Styled brand wordmark mimicking the uploaded brand logo structure */}
      {withText && (
        <span 
          style={{
            WebkitTextStroke: size === 'xl' ? '1.5px rgba(255, 255, 255, 0.95)' : '1px rgba(255, 255, 255, 0.9)',
          }}
          className={`font-sans font-bold ${textSizeMap[size]} tracking-wide text-transparent select-none`}
        >
          Cenivo
        </span>
      )}
    </div>
  );
}
