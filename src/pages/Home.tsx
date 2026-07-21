import { Link } from 'react-router-dom';
import * as LucideIcons from 'lucide-react';
import { DIAGRAM_TYPES } from '../data/diagramTypes';
import { getQuestionsByType } from '../data/questions';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-topcit-600 rounded-xl flex items-center justify-center shadow-lg">
              <LucideIcons.PencilRuler size={28} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800">TOPCIT Diagram Practice</h1>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Practice building diagrams for the TOPCIT exam with drag-and-drop.
            Choose a diagram type below to start practicing.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {DIAGRAM_TYPES.map((dt) => {
            const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[dt.icon] || LucideIcons.Square;
            const questionCount = getQuestionsByType(dt.id).length;
            return (
              <Link
                key={dt.id}
                to={`/practice/${dt.id}`}
                className="group bg-white rounded-2xl border border-gray-200 p-5 hover:shadow-xl hover:border-transparent transition-all duration-200 hover:-translate-y-1"
              >
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: `${dt.color}20` }}
                >
                  <Icon size={28} className="text-gray-700" />
                </div>
                <h3 className="text-base font-bold text-gray-800 mb-1">{dt.name}</h3>
                <p className="text-sm text-gray-500 mb-3 leading-snug">{dt.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">
                    {questionCount} question{questionCount !== 1 ? 's' : ''}
                  </span>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                    style={{ background: `${dt.color}20` }}
                  >
                    <LucideIcons.ArrowRight size={14} style={{ color: dt.color }} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-12 bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-3">About TOPCIT Diagram Questions</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            TOPCIT (Test of Practical Competence in IT) includes performance-based questions
            that evaluate practical abilities such as diagram design. The diagram types tested include:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
            {DIAGRAM_TYPES.map(dt => (
              <div key={dt.id} className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 rounded-full" style={{ background: dt.color }} />
                {dt.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
