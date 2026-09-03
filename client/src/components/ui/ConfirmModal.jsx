import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Check } from 'lucide-react';
import { Button } from './Button';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, description, confirmText = "Confirm", cancelText = "Cancel", isDanger = false, icon: Icon = AlertTriangle }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 10 }} 
            animate={{ scale: 1, opacity: 1, y: 0 }} 
            exit={{ scale: 0.95, opacity: 0, y: -10 }} 
            className="relative w-full max-w-md bg-card border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-10"
          >
            {/* Header pattern based on danger state */}
            <div className={`h-2 w-full ${isDanger ? 'bg-destructive' : 'bg-primary'}`}></div>
            
            <div className="p-6 sm:p-8">
              <div className="flex gap-4 sm:gap-5 items-start">
                <div className={`shrink-0 p-3 rounded-full ${isDanger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
                  <Icon size={24} />
                </div>
                <div className="space-y-2 mt-1">
                  <h3 className="text-xl font-bold tracking-tight text-foreground">{title}</h3>
                  <p className="text-sm text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap">{description}</p>
                </div>
              </div>
              
              <div className="mt-8 flex flex-col sm:flex-row justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={onClose}
                  className="w-full sm:w-auto font-semibold"
                >
                  <X size={16} className="mr-2 opacity-50" />
                  {cancelText}
                </Button>
                <Button 
                  variant={isDanger ? "destructive" : "default"} 
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="w-full sm:w-auto font-semibold shadow-lg"
                >
                  <Check size={16} className="mr-2" />
                  {confirmText}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmModal;
