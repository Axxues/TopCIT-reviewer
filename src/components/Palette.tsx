import type { NodeTypeDefinition, DiagramType, EdgeTypeDefinition } from '../data/diagramTypes';
import * as LucideIcons from 'lucide-react';

interface PaletteProps {
  nodeTypes: NodeTypeDefinition[];
  edgeTypes?: EdgeTypeDefinition[];
  diagramType: DiagramType;
  selectedEdgeType?: EdgeTypeDefinition | null;
  onSelectEdgeType?: (et: EdgeTypeDefinition | null) => void;
}

export default function Palette({ nodeTypes, edgeTypes, selectedEdgeType, onSelectEdgeType }: PaletteProps) {
  const onDragStart = (event: React.DragEvent, nodeType: NodeTypeDefinition) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-60 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Elements Palette</h3>
        <p className="text-xs text-gray-400 mt-1">Drag elements onto the canvas</p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {nodeTypes.map((nt) => {
          const Icon = (LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[nt.icon] || LucideIcons.Square;
          return (
            <div
              key={nt.type}
              draggable
              onDragStart={(e) => onDragStart(e, nt)}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-grab active:cursor-grabbing transition-all bg-white"
              style={{ borderLeft: `4px solid ${nt.color}` }}
            >
              <div
                className="flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0"
                style={{ background: `${nt.color}20` }}
              >
                <Icon size={18} className="text-gray-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700">{nt.label}</div>
              </div>
            </div>
          );
        })}

        {edgeTypes && edgeTypes.length > 0 && (
          <>
            <div className="pt-3 pb-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Edge Types</div>
              <p className="text-xs text-gray-400 mt-0.5">Select before connecting nodes</p>
            </div>
            {edgeTypes.map((et) => {
              const isSelected = selectedEdgeType?.type === et.type;
              return (
                <button
                  key={et.type}
                  onClick={() => onSelectEdgeType?.(isSelected ? null : et)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                    isSelected
                      ? 'border-blue-400 bg-blue-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <svg width="48" height="20" className="flex-shrink-0">
                    <defs>
                      <marker id="palette-arrow-filled" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                        <path d="M0,0 L8,4 L0,8 Z" fill="#475569" />
                      </marker>
                      <marker id="palette-arrow-hollow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
                        <path d="M0,0 L8,4.5 L0,9 Z" fill="#fff" stroke="#475569" strokeWidth="1.2" />
                      </marker>
                      <marker id="palette-diamond-hollow" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto">
                        <path d="M1,6 L6,1 L11,6 L6,11 Z" fill="#fff" stroke="#475569" strokeWidth="1.2" />
                      </marker>
                      <marker id="palette-diamond-filled" markerWidth="12" markerHeight="12" refX="11" refY="6" orient="auto">
                        <path d="M1,6 L6,1 L11,6 L6,11 Z" fill="#475569" stroke="#475569" strokeWidth="1.2" />
                      </marker>
                    </defs>
                    {et.sourceMarker?.startsWith('crow-') || et.targetMarker?.startsWith('crow-') ? (
                      <g stroke="#475569" strokeWidth="1.2" fill="none">
                        <line x1="6" y1="10" x2="42" y2="10" strokeDasharray={et.lineStyle === 'dashed' ? '5 3' : et.lineStyle === 'dotted' ? '2 2' : undefined} />
                        {et.sourceMarker === 'crow-one' && <line x1="6" y1="4" x2="6" y2="16" />}
                        {et.sourceMarker === 'crow-many' && (<><line x1="6" y1="10" x2="2" y2="4" /><line x1="6" y1="10" x2="2" y2="16" /></>)}
                        {et.sourceMarker === 'crow-optional' && (<><circle cx="10" cy="10" r="3" /><line x1="13" y1="10" x2="9" y2="4" /><line x1="13" y1="10" x2="9" y2="16" /></>)}
                        {et.sourceMarker === 'crow-mandatory' && (<><line x1="10" y1="4" x2="10" y2="16" /><line x1="13" y1="10" x2="9" y2="4" /><line x1="13" y1="10" x2="9" y2="16" /></>)}
                        {et.targetMarker === 'crow-one' && <line x1="42" y1="4" x2="42" y2="16" />}
                        {et.targetMarker === 'crow-many' && (<><line x1="42" y1="10" x2="46" y2="4" /><line x1="42" y1="10" x2="46" y2="16" /></>)}
                        {et.targetMarker === 'crow-optional' && (<><circle cx="38" cy="10" r="3" /><line x1="35" y1="10" x2="39" y2="4" /><line x1="35" y1="10" x2="39" y2="16" /></>)}
                        {et.targetMarker === 'crow-mandatory' && (<><line x1="38" y1="4" x2="38" y2="16" /><line x1="35" y1="10" x2="39" y2="4" /><line x1="35" y1="10" x2="39" y2="16" /></>)}
                      </g>
                    ) : (
                      <line
                        x1={et.sourceMarker === 'diamond' || et.sourceMarker === 'diamond-filled' ? 14 : 2}
                        y1="10"
                        x2="34"
                        y2="10"
                        stroke="#475569"
                        strokeWidth="2"
                        strokeDasharray={et.lineStyle === 'dashed' ? '5 3' : et.lineStyle === 'dotted' ? '2 2' : undefined}
                        markerStart={et.sourceMarker === 'diamond' ? 'url(#palette-diamond-hollow)' : et.sourceMarker === 'diamond-filled' ? 'url(#palette-diamond-filled)' : undefined}
                        markerEnd={et.targetMarker === 'arrow-filled' ? 'url(#palette-arrow-filled)' : et.targetMarker === 'arrow' ? 'url(#palette-arrow-hollow)' : undefined}
                      />
                    )}
                  </svg>
                  <span className="text-xs font-medium text-gray-700">{et.label}</span>
                </button>
              );
            })}
          </>
        )}
      </div>
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-400">
          Scroll to pan, Ctrl+Scroll to zoom, Shift+Scroll for vertical pan. Drag from handles to connect.
        </p>
      </div>
    </div>
  );
}
