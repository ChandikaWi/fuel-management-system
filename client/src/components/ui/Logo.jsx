import { Fuel } from 'lucide-react';
import { cn } from '../../utils/cn';

export function Logo({ className, iconSize = 24, hideText = false }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="p-1.5 bg-primary/10 dark:bg-primary/20 rounded-lg text-primary flex items-center justify-center">
        <Fuel size={iconSize} className="fill-primary/20" />
      </div>
      {!hideText && (
        <span className="text-xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
          FuelMaster
        </span>
      )}
    </div>
  );
}
