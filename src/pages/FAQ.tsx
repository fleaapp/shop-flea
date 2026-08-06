import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FAQSection from '@/components/FAQSection';
import { safeNavigateBack } from '@/utils/safeBack';

const FAQ = () => {
  const navigate = useNavigate();

  return (
    <div className="native-safe-top fixed inset-0 flex flex-col bg-background overflow-hidden">
      <header className="shrink-0 bg-background px-4 py-4 flex items-center">
        <button aria-label="Back" onClick={() => safeNavigateBack(navigate, '/profile')} className="absolute left-4">
          <ChevronLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground text-center w-full">❓ FAQ</h1>
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-8">
        <FAQSection />
      </div>
    </div>
  );
};

export default FAQ;
