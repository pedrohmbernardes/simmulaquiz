import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-gray-200 bg-gray-50/50 py-16 text-center animate-in fade-in zoom-in-95 duration-500">
      <div className="mb-6 rounded-full bg-white p-6 text-gray-300 shadow-sm">
        <Icon size={48} />
      </div>
      <h3 className="text-xl font-bold text-gray-700 font-oswald uppercase">{title}</h3>
      <p className="max-w-md text-sm text-gray-500 mt-2 font-lato leading-relaxed px-4">
        {description}
      </p>
      
      {actionLabel && actionHref && (
        <Link 
          href={actionHref}
          className="mt-8 px-6 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 transition-all font-oswald uppercase tracking-wide"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}