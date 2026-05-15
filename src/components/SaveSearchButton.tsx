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
  const filterCount = Object.keys(filters || {}).length;
  const canSave = trimmed.length > 0 || filterCount > 0;

  if (!canSave) return null;

  // Use query as the saved key. If only filters are active (no query), build a synthetic label.
  const savedKey = trimmed.length > 0
    ? trimmed
    : `Filters (${filterCount})`;
  const alreadySaved = isSaved(savedKey);

  const handleClick = async () => {
    if (!user) {
      toast.error('Sign in to save searches.');
      return;
    }
    if (alreadySaved) {
      toast('💾 Search already saved.');
      return;
    }
    await saveSearch(savedKey, filters || {});
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
