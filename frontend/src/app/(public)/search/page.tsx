import type { Metadata } from 'next';
import AISearchView from '@/components/public/search/AISearchView';

export const metadata: Metadata = {
  title: 'AI Search | Buildora',
  description: 'Describe the apartment or construction company you’re looking for in your own words.',
};

export default function SearchPage() {
  return <AISearchView />;
}
