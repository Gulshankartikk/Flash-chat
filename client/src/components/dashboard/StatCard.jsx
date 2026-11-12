import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

export const StatCard = ({
  title,
  value,
  sub,
  change = '+0.0%',
  icon: Icon,
  hot = false,
  sparklineData = [12, 18, 14, 25, 20, 28, 32],
  onClick,
  className = ''
}) => {
  const isPositive = !String(change).startsWith('-');

  // Compute smooth SVG polyline / curve for sparkline
  const minVal = Math.min(...sparklineData);
  const maxVal = Math.max(...sparklineData);
  const range = maxVal - minVal || 1;
  const width = 84;
  const height = 32;
  const points = sparklineData
    .map((val, idx) => {
      const x = (idx / (sparklineData.length - 1)) * width;
      const y = height - ((val - minVal) / range) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const strokeColor = hot ? '#ffffff' : isPositive ? 'var(--good)' : 'var(--bad)';
  const areaPoints = `0,${height} ${points} ${width},${height}`;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className={`${
        hot ? 'coral-card' : 'glass text-ink'
      } p-5 relative overflow-hidden rounded-[26px] cursor-pointer select-none transition-shadow duration-200 hover:shadow-xl motion-reduce:transform-none ${className}`}
    >
      {/* Top Row: Round Icon & Change Badge */}
      <div className="flex items-center justify-between mb-3">
        {/* Round Icon */}
        <div
          className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xs border ${
            hot
              ? 'bg-white/20 text-white border-white/30'
              : 'bg-white/40 text-[#f0735f] border-edge'
          }`}
        >
          {Icon && <Icon className="w-5 h-5 stroke-[2.2px]" />}
        </div>

        {/* Change Badge (green up / red down) */}
        <div
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${
            hot
              ? 'bg-white/20 text-white border-white/30'
              : isPositive
              ? 'bg-[#2f9e6b]/15 text-[#2f9e6b] border-[#2f9e6b]/30'
              : 'bg-[#e04a3a]/15 text-[#e04a3a] border-[#e04a3a]/30'
          }`}
        >
          {isPositive ? (
            <TrendingUp className="w-3 h-3 stroke-[2.5px]" />
          ) : (
            <TrendingDown className="w-3 h-3 stroke-[2.5px]" />
          )}
          <span>{change}</span>
        </div>
      </div>

      {/* Title */}
      <div
        className={`text-xs font-semibold uppercase tracking-wider ${
          hot ? 'text-white/80' : 'text-ink-soft'
        }`}
      >
        {title}
      </div>

      {/* Bada Value */}
      <div
        className={`text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 leading-tight ${
          hot ? 'text-white' : 'text-ink'
        }`}
      >
        {value}
      </div>

      {/* Bottom Area: Chhota Sub-text & Bottom-right Sparkline SVG */}
      <div className="flex items-end justify-between mt-2 pt-1">
        <span
          className={`text-xs font-medium truncate max-w-[120px] ${
            hot ? 'text-white/80' : 'text-ink-soft'
          }`}
        >
          {sub}
        </span>

        {/* Sparkline SVG */}
        <div className="w-[84px] h-[32px] flex-shrink-0 opacity-80">
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <linearGradient id={`grad-${title.replace(/\s+/g, '-')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={hot ? 0.4 : 0.25} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <polygon
              points={areaPoints}
              fill={`url(#grad-${title.replace(/\s+/g, '-')})`}
            />
            <polyline
              fill="none"
              stroke={strokeColor}
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      </div>
    </motion.div>
  );
};

export default StatCard;
