import { Bookmark, BookmarkCheck } from 'lucide-react';
import { useSavedSearches } from '@/hooks/useSavedSearches';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface SaveSearchButtonProps {
  query: string;
  filters: Record<string, any>;
}

const SaveSearchButton = ({ query, filters }: SaveSearchButtonProps) => {
  const { user } = useAuth();
  const { saveSearch, isSaved } = useSavedSearches();

  const trimmed = (query || '').trim();
  const cleanedFilters = Object.fromEntries(
    Object.entries(filters || {}).filter(([, v]) => {
      if (v === null || v === undefined || v === '') return false;
      if (Array.isArray(v)) return v.length > 0;
      return true;
    })
  );
  const filterCount = Object.keys(cleanedFilters).length;
  const canSave = trimmed.length > 0 || filterCount > 0;

  if (!canSave) return null;

  // Only show "saved" state when the EXACT query+filters combo is already saved.
  const alreadySaved = isSaved(trimmed, cleanedFilters);

  const handleClick = async () => {
    if (!user) {
      toast.error('Sign in to save searches.');
      return;
    }
    console.log('[SaveSearchButton] saving', { trimmed, cleanedFilters, rawFilters: filters });
    await saveSearch(trimmed, cleanedFilters);
  };

  return (
    <button
      onClick={handleClick}
      aria-label={alreadySaved ? 'Search saved' : 'Save this search'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
        alreadySaved
          ? 'bg-primary border-primary text-primary-foreground'
          : 'bg-secondary border-border text-secondary-foreground hover:bg-secondary/80'
      }`}
    >
      {alreadySaved ? (
        <BookmarkCheck className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
    </button>
  );
};

export default SaveSearchButton;
