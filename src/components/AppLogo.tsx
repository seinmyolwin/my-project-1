import React from 'react';

interface AppLogoProps {
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  className = '',
  size = 'md',
  showText = false
}) => {
  const sizeMap = {
    xs: 'w-7 h-7',
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20'
  };

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className={`${sizeMap[size]} rounded-2xl overflow-hidden shadow-sm border border-amber-300/60 bg-amber-50 flex items-center justify-center shrink-0`}>
        <img
          src="/app-logo.png"
          alt="ရွှေမင်္ဂလာ Logo"
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback if image fails to load
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
      {showText && (
        <div className="leading-tight">
          <span className="font-black text-slate-900 text-sm block">ရွှေမင်္ဂလာ</span>
          <span className="text-[10px] text-amber-700 font-bold block">စီမံခန့်ခွဲမှုစနစ်</span>
        </div>
      )}
    </div>
  );
};
