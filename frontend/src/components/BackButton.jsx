import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function BackButton({ to, label = 'Volver', className = '' }) {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => (to ? navigate(to) : navigate(-1))}
      className={`flex items-center gap-1.5 text-sm text-gray-600 hover:text-aut-verde font-medium ${className}`}
    >
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}
