import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FAQSection from '@/components/FAQSection';
import { safeNavigateBack } from '@/utils/safeBack';

const FAQ = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-8">
      <header className="sticky top-0 z-40 bg-background px-4 py-4 flex items-center">
        <button onClick={() => safeNavigateBack(navigate, '/profile')} className="absolute left-4">
          <ChevronLeft className="h-6 w-6 text-foreground" />
        </button>
        <h1 className="text-xl font-bold text-foreground text-center w-full">❓ FAQ</h1>
      </header>
      <div className="px-4">
        <FAQSection />
      </div>
    </div>
  );
};

export default FAQ;
