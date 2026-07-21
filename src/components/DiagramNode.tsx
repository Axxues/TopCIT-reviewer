import { memo, useState, useCallback, useRef, createContext, useContext, useEffect } from 'react';
import {
  Handle, Position, useReactFlow,
  type NodeProps, type Node,
  BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps,
  NodeResizer,
} from '@xyflow/react';
import type { NodeTypeDefinition, NodeShape } from '../data/diagramTypes';

type SetNodes = (payload: Node[] | ((nodes: Node[]) => Node[])) => void;
type SetEdges = (payload: any[] | ((edges: any[]) => any[])) => void;

export const NodeUpdateContext = createContext<{ setNodes: SetNodes; setEdges: SetEdges } | null>(null);
export const ConnectionContext = createContext<boolean>(false);

function useNodeUpdaters() {
  const ctx = useContext(NodeUpdateContext);
  const rf = useReactFlow();
  return ctx ?? { setNodes: rf.setNodes as SetNodes, setEdges: rf.setEdges as SetEdges };
}

export interface Swimlane {
  id: string;
  label: string;
  height?: number;
  width?: number;
}

export interface DiagramNodeData {
  label: string;
  nodeType: NodeTypeDefinition;
  fields?: string[];
  methods?: string[];
  attrs?: string[];
  tableColumns?: { name: string; isPK: boolean }[];
  lanes?: Swimlane[];
  rotation?: number;
  [key: string]: unknown;
}

const TEXT = '#1e293b';

function labelStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    textAlign: 'center', width: '100%', height: '100%',
    padding: '8px', fontSize: '13px', fontWeight: 500, color: TEXT,
    whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4,
    pointerEvents: 'none', ...extra,
  };
}

function EditableNodeLabel({ label, onEditLabel, extraStyle }: { label: string; onEditLabel?: (v: string) => void; extraStyle?: React.CSSProperties }) {
  if (onEditLabel) {
    return (
      <div style={labelStyle(extraStyle)}>
        <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '13px', fontWeight: 500, color: TEXT }} />
      </div>
    );
  }
  return <div style={labelStyle(extraStyle)}>{label}</div>;
}

function darken(hex: string, amt = 60): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#475569';
  const n = parseInt(clean, 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - amt);
  const g = Math.max(0, ((n >> 8) & 0xff) - amt);
  const b = Math.max(0, (n & 0xff) - amt);
  return `rgb(${r},${g},${b})`;
}

function safeColor(c: string, fallback = '#3b82f6'): string {
  return c.startsWith('#') && c.length === 7 ? c : fallback;
}

/* ─── Actor (stickman) ─── */
function ActorShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#3b82f6');
  const dc = darken(c, 60);
  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', pointerEvents: 'none' }}>
      <svg width="40" height="60" viewBox="0 0 40 60" style={{ flexShrink: 0 }}>
        <circle cx="20" cy="10" r="7" fill="none" stroke={dc} strokeWidth="2.5" />
        <line x1="20" y1="17" x2="20" y2="38" stroke={dc} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="8" y1="26" x2="32" y2="26" stroke={dc} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="20" y1="38" x2="10" y2="52" stroke={dc} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="20" y1="38" x2="30" y2="52" stroke={dc} strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div style={{ fontSize: '12px', fontWeight: 600, color: TEXT, marginTop: 2, textAlign: 'center', maxWidth: width }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '12px', fontWeight: 600, color: TEXT }} /> : label}
      </div>
    </div>
  );
}

/* ─── Bar (fork/join) ─── */
function BarShape({ color, width, height }: { color: string; width: number; height: number }) {
  return (
    <div style={{ width, height, background: color, borderRadius: '2px', pointerEvents: 'none' }} />
  );
}

/* ─── Cancel ─── */
function CancelShape({ color, width, height }: { color: string; width: number; height: number }) {
  const c = safeColor(color, '#ef4444');
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `3px solid ${c}`, background: '#fff' }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: height * 0.5, height: 3, background: c, transform: 'rotate(45deg)', position: 'absolute' }} />
        <div style={{ width: height * 0.5, height: 3, background: c, transform: 'rotate(-45deg)', position: 'absolute' }} />
      </div>
    </div>
  );
}

/* ─── Swimlane Pool (Horizontal) ─── */
function SwimlanePoolHShape({ color, label, width, height, lanes, onUpdateLanes, onEditLabel, onEditLaneLabel }: {
  color: string; label: string; width: number; height: number;
  lanes: Swimlane[]; onUpdateLanes?: (lanes: Swimlane[]) => void;
  onEditLabel?: (v: string) => void;
  onEditLaneLabel?: (laneId: string, v: string) => void;
}) {
  const c = safeColor(color, '#64748b');
  const dc = darken(c, 40);
  const headerW = 28;
  const laneLabelW = 80;
  const addBtnH = 24;
  const contentH = height - addBtnH;
  const defaultLaneH = lanes.length > 0 ? contentH / lanes.length : contentH;
  const laneHeights = lanes.map(l => l.height || defaultLaneH);
  const resizeRef = useRef<{ index: number; startY: number; startHeights: number[] } | null>(null);

  const addLane = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateLanes) return;
    onUpdateLanes([...lanes, { id: `lane_${Date.now()}`, label: `Lane ${lanes.length + 1}` }]);
  };
  const removeLane = (e: React.MouseEvent, laneId: string) => {
    e.stopPropagation();
    if (!onUpdateLanes) return;
    onUpdateLanes(lanes.filter(l => l.id !== laneId));
  };

  const onResizeStart = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { index, startY: e.clientY, startHeights: [...laneHeights] };
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  };
  const onResizeMove = (e: MouseEvent) => {
    if (!resizeRef.current || !onUpdateLanes) return;
    const { index, startY, startHeights } = resizeRef.current;
    const dy = e.clientY - startY;
    const newHeights = [...startHeights];
    const minH = 30;
    const maxAdjust = newHeights[index + 1] - minH;
    const adjust = Math.max(-startHeights[index] + minH, Math.min(dy, maxAdjust));
    newHeights[index] = startHeights[index] + adjust;
    newHeights[index + 1] = startHeights[index + 1] - adjust;
    onUpdateLanes(lanes.map((l, i) => ({ ...l, height: newHeights[i] })));
  };
  const onResizeEnd = () => {
    resizeRef.current = null;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  };

  return (
    <div style={{ width, height, border: `2px solid ${dc}`, borderRadius: '4px', display: 'flex', flexDirection: 'column', pointerEvents: 'none', background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flex: 1 }}>
        {/* Pool title header */}
        <div style={{ width: headerW, background: c, opacity: 0.85, borderRight: `2px solid ${dc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', writingMode: 'vertical-rl' as const, fontSize: '12px', fontWeight: 700, color: '#fff', transform: 'rotate(180deg)', padding: '4px 0', position: 'relative' }}>
          {onEditLabel ? (
            <InlineEditableText
              text={label}
              onEdit={onEditLabel}
              style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}
              editStyle={{
                writingMode: 'vertical-rl' as const,
                transform: 'none',
                height: '100%',
                width: '100%',
                background: 'transparent',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #3b82f6',
                borderRadius: '3px',
              }}
            />
          ) : label}
        </div>
        {/* Lanes */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {lanes.map((lane, i) => (
            <div key={lane.id} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', height: laneHeights[i] }}>
                <div style={{ width: laneLabelW, background: `${c}25`, borderRight: `1px solid ${dc}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: dc, padding: '4px', position: 'relative' }}>
                  {onEditLaneLabel ? (
                    <InlineEditableText text={lane.label} onEdit={(v) => onEditLaneLabel(lane.id, v)} style={{ color: dc, fontSize: '11px', fontWeight: 600 }} />
                  ) : lane.label}
                  {onUpdateLanes && lanes.length > 1 && (
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={(e) => removeLane(e, lane.id)}
                      style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'all', lineHeight: 1, padding: 0, boxSizing: 'border-box' }}
                    ><svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M2 2L8 8M8 2L2 8" /></svg></button>
                  )}
                </div>
                <div style={{ flex: 1, background: i % 2 === 0 ? '#f8fafc' : '#fff' }} />
              </div>
              {i < lanes.length - 1 && (
                <>
                  <div
                    onMouseDown={(e) => onResizeStart(e, i)}
                    className="nodrag"
                    style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 8,
                      cursor: 'ns-resize', pointerEvents: 'all', zIndex: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <div style={{ width: 40, height: 3, borderRadius: 2, background: dc + '80' }} />
                  </div>
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: dc + '60', pointerEvents: 'none' }} />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Add lane button */}
      {onUpdateLanes && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={addLane}
          style={{ height: addBtnH, border: 'none', borderTop: `1px solid ${dc}60`, background: `${c}15`, color: dc, fontSize: '12px', fontWeight: 600, cursor: 'pointer', pointerEvents: 'all', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          + Add Lane
        </button>
      )}
    </div>
  );
}

/* ─── Swimlane Pool (Vertical) ─── */
function SwimlanePoolVShape({ color, label, width, height, lanes, onUpdateLanes, onEditLabel, onEditLaneLabel }: {
  color: string; label: string; width: number; height: number;
  lanes: Swimlane[]; onUpdateLanes?: (lanes: Swimlane[]) => void;
  onEditLabel?: (v: string) => void;
  onEditLaneLabel?: (laneId: string, v: string) => void;
}) {
  const c = safeColor(color, '#64748b');
  const dc = darken(c, 40);
  const headerH = 28;
  const laneLabelH = 24;
  const addBtnW = 28;
  const contentW = width - addBtnW;
  const defaultLaneW = lanes.length > 0 ? contentW / lanes.length : contentW;
  const laneWidths = lanes.map(l => l.width || defaultLaneW);
  const resizeRef = useRef<{ index: number; startX: number; startWidths: number[] } | null>(null);

  const addLane = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onUpdateLanes) return;
    onUpdateLanes([...lanes, { id: `lane_${Date.now()}`, label: `Lane ${lanes.length + 1}` }]);
  };
  const removeLane = (e: React.MouseEvent, laneId: string) => {
    e.stopPropagation();
    if (!onUpdateLanes) return;
    onUpdateLanes(lanes.filter(l => l.id !== laneId));
  };

  const onResizeStart = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = { index, startX: e.clientX, startWidths: [...laneWidths] };
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  };
  const onResizeMove = (e: MouseEvent) => {
    if (!resizeRef.current || !onUpdateLanes) return;
    const { index, startX, startWidths } = resizeRef.current;
    const dx = e.clientX - startX;
    const newWidths = [...startWidths];
    const minW = 40;
    const maxAdjust = newWidths[index + 1] - minW;
    const adjust = Math.max(-startWidths[index] + minW, Math.min(dx, maxAdjust));
    newWidths[index] = startWidths[index] + adjust;
    newWidths[index + 1] = startWidths[index + 1] - adjust;
    onUpdateLanes(lanes.map((l, i) => ({ ...l, width: newWidths[i] })));
  };
  const onResizeEnd = () => {
    resizeRef.current = null;
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  };

  return (
    <div style={{ width, height, border: `2px solid ${dc}`, borderRadius: '4px', display: 'flex', flexDirection: 'row', pointerEvents: 'none', background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Pool title header */}
        <div style={{ height: headerH, background: c, opacity: 0.85, borderBottom: `2px solid ${dc}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', padding: '4px' }}>
          {onEditLabel ? (
            <InlineEditableText text={label} onEdit={onEditLabel} style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }} />
          ) : label}
        </div>
        {/* Lanes */}
        <div style={{ display: 'flex', flex: 1 }}>
          {lanes.map((lane, i) => (
            <div key={lane.id} style={{ position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column', width: laneWidths[i] }}>
                <div style={{ height: laneLabelH, background: `${c}25`, borderBottom: `1px solid ${dc}60`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: dc, padding: '2px', position: 'relative' }}>
                  {onEditLaneLabel ? (
                    <InlineEditableText text={lane.label} onEdit={(v) => onEditLaneLabel(lane.id, v)} style={{ color: dc, fontSize: '11px', fontWeight: 600 }} />
                  ) : lane.label}
                  {onUpdateLanes && lanes.length > 1 && (
                    <button
                      onMouseDown={e => e.stopPropagation()}
                      onClick={(e) => removeLane(e, lane.id)}
                      style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'all', lineHeight: 1, padding: 0, boxSizing: 'border-box' }}
                    ><svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M2 2L8 8M8 2L2 8" /></svg></button>
                  )}
                </div>
                <div style={{ flex: 1, background: i % 2 === 0 ? '#f8fafc' : '#fff' }} />
              </div>
              {i < lanes.length - 1 && (
                <>
                  <div
                    onMouseDown={(e) => onResizeStart(e, i)}
                    className="nodrag"
                    style={{
                      position: 'absolute', top: 0, bottom: 0, right: 0, width: 8,
                      cursor: 'ew-resize', pointerEvents: 'all', zIndex: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <div style={{ height: 40, width: 3, borderRadius: 2, background: dc + '80' }} />
                  </div>
                  <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 1, background: dc + '60', pointerEvents: 'none' }} />
                </>
              )}
            </div>
          ))}
        </div>
      </div>
      {/* Add lane button */}
      {onUpdateLanes && (
        <button
          onMouseDown={e => e.stopPropagation()}
          onClick={addLane}
          style={{ width: addBtnW, border: 'none', borderLeft: `1px solid ${dc}60`, background: `${c}15`, color: dc, fontSize: '14px', fontWeight: 700, cursor: 'pointer', pointerEvents: 'all', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >+</button>
      )}
    </div>
  );
}

/* ─── Do-While ─── */
function DoWhileShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#7dd3fc');
  const dc = darken(c, 60);
  const condH = 24;
  const bodyH = height - condH;
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <rect x={1} y={1} width={width - 2} height={bodyH - 1} rx={10} ry={10} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
        <path d={`M 1 ${bodyH} L 1 ${height - 10} Q 1 ${height - 2} 10 ${height - 2} L ${width - 10} ${height - 2} Q ${width - 1} ${height - 2} ${width - 1} ${height - 10} L ${width - 1} ${bodyH} Z`} fill={'#fff'} stroke={dc} strokeWidth={2} />
        <line x1={1} y1={bodyH} x2={width - 1} y2={bodyH} stroke={dc} strokeWidth={1.5} strokeDasharray="4 3" />
        <path d={`M 0 ${bodyH * 0.4} Q -12 ${bodyH * 0.4} -12 ${bodyH * 0.7} Q -12 ${bodyH + 4} 0 ${bodyH + 4}`} fill="none" stroke={dc} strokeWidth={1.5} />
        <path d={`M 0 ${bodyH + 4} L 6 ${bodyH + 1} L 6 ${bodyH + 7} Z`} fill={dc} />
      </svg>
      <div style={{
        position: 'absolute', top: 0, left: 0, width: '100%', height: bodyH,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: 600, color: TEXT, padding: '8px',
        textAlign: 'center', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '13px', fontWeight: 600, color: TEXT }} /> : label}
      </div>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, width: '100%', height: condH,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '11px', fontWeight: 700, color: dc, fontStyle: 'italic',
      }}>while</div>
    </div>
  );
}

/* ─── Class Box ─── */
function ClassBoxShape({ color, label, width, height, variant, data, onEditLabel, onEditFields, onEditMethods }: { color: string; label: string; width: number; height: number; variant?: string; data: DiagramNodeData; onEditLabel?: (v: string) => void; onEditFields?: (v: string[]) => void; onEditMethods?: (v: string[]) => void }) {
  const c = safeColor(color, '#c4b5fd');
  const dc = darken(c, 60);
  const fields = data.fields || [];
  const methods = data.methods || [];
  const isInterface = variant === 'interface';
  return (
    <div style={{ width, minHeight: height, border: `2px solid ${dc}`, borderRadius: '2px', background: '#fff', display: 'flex', flexDirection: 'column', pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ background: c, opacity: 0.9, padding: '4px 8px', textAlign: 'center', fontWeight: 500, fontSize: '14px', color: TEXT, borderBottom: `2px solid ${dc}` }}>
        {isInterface && <div style={{ fontSize: '11px', fontStyle: 'italic', opacity: 0.8 }}>«interface»</div>}
        {onEditLabel ? (
          <InlineEditableText text={label} onEdit={onEditLabel} style={{ color: TEXT, fontSize: '14px', fontWeight: 500 }} />
        ) : label}
      </div>
      <div style={{ padding: '4px 8px', fontSize: '12px', color: TEXT, borderBottom: `1px solid ${dc}40`, minHeight: '24px' }}>
        {onEditFields ? (
          <EditableList items={fields} onEdit={onEditFields} placeholder="No fields" itemStyle={{ color: TEXT, fontSize: '12px' }} addLabel="Field" />
        ) : fields.length > 0 ? fields.map((f, i) => <div key={i}>{f}</div>) : <div style={{ color: '#94a3b8' }}>+ field: Type</div>}
      </div>
      <div style={{ padding: '4px 8px', fontSize: '12px', color: TEXT, minHeight: '24px' }}>
        {onEditMethods ? (
          <EditableList items={methods} onEdit={onEditMethods} placeholder="No methods" itemStyle={{ color: TEXT, fontSize: '12px', fontStyle: 'italic' }} addLabel="Method" />
        ) : methods.length > 0 ? methods.map((m, i) => <div key={i} style={{ fontStyle: 'italic' }}>{m}</div>) : <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>+ method(): Type</div>}
      </div>
    </div>
  );
}

/* ─── Object Box ─── */
function ObjectBoxShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; data: DiagramNodeData; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#d8b4fe');
  const dc = darken(c, 60);
  const displayLabel = label.startsWith(':') ? label : `:${label}`;
  return (
    <div style={{ width, minHeight: height, border: `2px solid ${dc}`, borderRadius: '2px', background: '#fff', display: 'flex', flexDirection: 'column', pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ background: c, opacity: 0.9, padding: '4px 8px', textAlign: 'center', fontWeight: 500, fontSize: '13px', color: TEXT, borderBottom: `2px solid ${dc}` }}>
        {onEditLabel ? (
          <InlineEditableText text={displayLabel} onEdit={onEditLabel} style={{ color: TEXT, fontSize: '13px', fontWeight: 500 }} />
        ) : displayLabel}
      </div>
    </div>
  );
}

/* ─── Package ─── */
function PackageShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#93c5fd');
  const dc = darken(c, 60);
  const tabW = Math.min(label.length * 8 + 16, width * 0.6);
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: tabW, height: 20, border: `2px solid ${dc}`, borderBottom: 'none', borderRadius: '4px 4px 0 0', background: c, opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: TEXT }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '11px', fontWeight: 600, color: TEXT }} /> : label}
      </div>
      <div style={{ position: 'absolute', top: 20, left: 0, width, height: height - 20, border: `2px solid ${dc}`, borderRadius: '0 4px 4px 4px', background: 'rgba(255,255,255,0.7)' }} />
    </div>
  );
}

/* ─── Note ─── */
function NoteShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#fde047');
  const dc = darken(c, 80);
  const fold = 16;
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <path d={`M 0 0 L ${width - fold} 0 L ${width} ${fold} L ${width} ${height} L 0 ${height} Z`} fill={c} fillOpacity={0.9} stroke={dc} strokeWidth={2} />
        <path d={`M ${width - fold} 0 L ${width - fold} ${fold} L ${width} ${fold}`} fill="none" stroke={dc} strokeWidth={1.5} />
      </svg>
      <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative', fontSize: '12px', color: TEXT }} />
    </div>
  );
}

/* ─── Provided Interface (lollipop) ─── */
function ProvidedInterfaceShape({ color, width, height }: { color: string; width: number; height: number }) {
  const c = safeColor(color, '#6366f1');
  const dc = darken(c, 60);
  const s = Math.min(width, height) * 0.6;
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: s, height: s, borderRadius: '50%', border: `2.5px solid ${dc}`, background: c, opacity: 0.85 }} />
    </div>
  );
}

/* ─── Required Interface (half circle, rotatable) ─── */
function RequiredInterfaceShape({ color, width, height, rotation = 0 }: { color: string; width: number; height: number; rotation?: number }) {
  const c = safeColor(color, '#6366f1');
  const dc = darken(c, 60);
  const s = Math.min(width, height) * 0.6;
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <svg width={s} height={s / 2} style={{ overflow: 'visible', transform: `rotate(${rotation}deg)`, transformOrigin: 'center' }}>
        <path d={`M 0 ${s / 2} A ${s / 2} ${s / 2} 0 0 1 ${s} ${s / 2}`} fill="none" stroke={dc} strokeWidth={2.5} />
      </svg>
    </div>
  );
}

/* ─── Lifeline (sequence object with dashed line) ─── */
function LifelineShape({ color, label, width, height }: { color: string; label: string; width: number; height: number }) {
  const c = safeColor(color, '#8b5cf6');
  const dc = darken(c, 60);
  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
      <div style={{ width: width - 20, minHeight: 40, border: `2px solid ${dc}`, borderRadius: '4px', background: c, opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: '13px', color: '#fff', padding: '4px' }}>
        {label}
      </div>
      <div style={{ width: 0, flex: 1, borderLeft: `2px dashed ${dc}` }} />
    </div>
  );
}

/* ─── Activation Box ─── */
function ActivationBoxShape({ color, width, height }: { color: string; width: number; height: number }) {
  const c = safeColor(color, '#fbbf24');
  const dc = darken(c, 60);
  return (
    <div style={{ width, height, border: `2px solid ${dc}`, background: c, opacity: 0.85, pointerEvents: 'none' }} />
  );
}

/* ─── Table (ER entity) ─── */
function TableShape({ color, label, width, height, data, onEditLabel, onEditColumns }: { color: string; label: string; width: number; height: number; data: DiagramNodeData; onEditLabel?: (v: string) => void; onEditColumns?: (v: { name: string; isPK: boolean }[]) => void }) {
  const c = safeColor(color, '#fdba74');
  const dc = darken(c, 60);
  const columns = data.tableColumns || [
    { name: 'id', isPK: true },
    { name: 'column2', isPK: false },
    { name: 'column3', isPK: false },
  ];
  const removeCol = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();
    onEditColumns?.(columns.filter((_, j) => j !== i));
  };
  const addCol = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEditColumns?.([...columns, { name: `column${columns.length + 1}`, isPK: false }]);
  };
  return (
    <div style={{ width, minHeight: height, border: `2px solid ${dc}`, borderRadius: '4px', background: '#fff', display: 'flex', flexDirection: 'column', pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ background: c, opacity: 0.9, padding: '4px 8px', textAlign: 'center', fontWeight: 500, fontSize: '14px', color: TEXT, borderBottom: `2px solid ${dc}` }}>
        {onEditLabel ? (
          <InlineEditableText text={label} onEdit={onEditLabel} style={{ color: TEXT, fontSize: '14px', fontWeight: 500 }} />
        ) : label}
      </div>
      {columns.map((col, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '3px 8px', fontSize: '12px', color: TEXT, borderBottom: i < columns.length - 1 ? `1px solid ${dc}30` : 'none', gap: 4 }}>
          {col.isPK && <span style={{ fontWeight: 700, textDecoration: 'underline', marginRight: 4 }}>PK</span>}
          <div style={{ flex: 1 }}>
            {onEditColumns ? (
              <InlineEditableText text={col.name} onEdit={(v) => onEditColumns(columns.map((cc, j) => j === i ? { ...cc, name: v } : cc))} style={{ color: TEXT, fontSize: '12px' }} />
            ) : <span>{col.name}</span>}
          </div>
          {onEditColumns && !col.isPK && (
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => removeCol(e, i)}
              className="nodrag"
              style={{
                flexShrink: 0, width: 16, height: 16, border: 'none', borderRadius: '50%',
                background: '#ef4444', color: '#fff', cursor: 'pointer',
                pointerEvents: 'all', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0, boxSizing: 'border-box',
              }}
            ><svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M2 2L8 8M8 2L2 8" /></svg></button>
          )}
        </div>
      ))}
      {onEditColumns && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={addCol}
          className="nodrag"
          style={{
            margin: '2px 8px', border: 'none', background: 'transparent', color: '#3b82f6',
            fontSize: '11px', cursor: 'pointer', pointerEvents: 'all', padding: '2px 0',
            textAlign: 'left',
          }}
        >+ Column</button>
      )}
    </div>
  );
}

/* ─── Comment Link ─── */
function CommentLinkShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#64748b');
  const dc = darken(c, 40);
  return (
    <div style={{ width, height, border: `2px solid ${dc}`, borderRadius: '4px', background: c, opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ fontSize: '12px', color: TEXT, textAlign: 'center', padding: '4px' }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '12px', color: TEXT }} /> : label}
      </div>
    </div>
  );
}

/* ─── Print/Document ─── */
function PrintShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#f9a8d4');
  const dc = darken(c, 80);
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <path d={`M 0 0 L ${width} 0 L ${width} ${height * 0.85} Q ${width * 0.75} ${height * 1.05} ${width * 0.5} ${height * 0.85} T 0 ${height * 0.85} Z`} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
      </svg>
      <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative' }} />
    </div>
  );
}

/* ─── Card ─── */
function CardShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#6ee7b7');
  const dc = darken(c, 80);
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <path d={`M ${width * 0.08} 0 L ${width} 0 L ${width} ${height} L 0 ${height} L 0 ${height * 0.15} Z`} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
      </svg>
      <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative' }} />
    </div>
  );
}

/* ─── Manual Input ─── */
function ManualInputShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#93c5fd');
  const dc = darken(c, 80);
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <path d={`M 0 ${height * 0.3} L ${width} 0 L ${width} ${height} L 0 ${height} Z`} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
      </svg>
      <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative', paddingTop: '12px' }} />
    </div>
  );
}

/* ─── Predefined Process ─── */
function PredefinedProcessShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#a5b4fc');
  const dc = darken(c, 80);
  const barW = 8;
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: c, opacity: 0.85, border: `2px solid ${dc}`, borderRadius: '2px' }} />
      <div style={{ position: 'absolute', top: 0, left: barW, bottom: 0, width: 2, background: dc }} />
      <div style={{ position: 'absolute', top: 0, right: barW, bottom: 0, width: 2, background: dc }} />
      <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative', padding: `0 ${barW + 6}px` }} />
    </div>
  );
}

/* ─── On-Page Ref ─── */
function OnPageRefShape({ color, label, width, height }: { color: string; label: string; width: number; height: number }) {
  const c = safeColor(color, '#fcd34d');
  const dc = darken(c, 80);
  const s = Math.min(width, height);
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: s, height: s, borderRadius: '50%', border: `2px solid ${dc}`, background: c, opacity: 0.85, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: dc }}>
        {label}
      </div>
    </div>
  );
}

/* ─── Off-Page Ref ─── */
function OffPageRefShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#fdba74');
  const dc = darken(c, 80);
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <path d={`M 0 0 L ${width} 0 L ${width} ${height * 0.75} L ${width / 2} ${height} L 0 ${height * 0.75} Z`} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
      </svg>
      <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative' }} />
    </div>
  );
}

/* ─── Display ─── */
function DisplayShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#67e8f9');
  const dc = darken(c, 80);
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <path d={`M ${width * 0.1} 0 L ${width * 0.9} 0 L ${width} ${height / 2} L ${width * 0.9} ${height} L ${width * 0.1} ${height} L 0 ${height / 2} Z`} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
      </svg>
      <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative' }} />
    </div>
  );
}

/* ─── Database (cylinder) ─── */
function DatabaseShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#a5b4fc');
  const dc = darken(c, 80);
  const ellipseH = 14;
  return (
    <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
      <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
        <ellipse cx={width / 2} cy={ellipseH} rx={width / 2} ry={ellipseH} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
        <rect x={0} y={ellipseH} width={width} height={height - ellipseH * 2} fill={c} fillOpacity={0.85} stroke="none" />
        <line x1={0} y1={ellipseH} x2={0} y2={height - ellipseH} stroke={dc} strokeWidth={2} />
        <line x1={width} y1={ellipseH} x2={width} y2={height - ellipseH} stroke={dc} strokeWidth={2} />
        <ellipse cx={width / 2} cy={height - ellipseH} rx={width / 2} ry={ellipseH} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
        <ellipse cx={width / 2} cy={ellipseH} rx={width / 2} ry={ellipseH} fill="none" stroke={dc} strokeWidth={1.5} strokeDasharray="4 3" />
      </svg>
      <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative', paddingTop: ellipseH + 4 }} />
    </div>
  );
}

/* ─── System Boundary ─── */
function SystemBoundaryShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#64748b');
  const dc = darken(c, 40);
  return (
    <div style={{ width, height, border: `2px dashed ${dc}`, borderRadius: '8px', background: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
      <div style={{ padding: '6px 12px', fontSize: '14px', fontWeight: 700, color: TEXT, textAlign: 'center', borderBottom: `1px solid ${dc}40` }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '14px', fontWeight: 700, color: TEXT }} /> : label}
      </div>
      <div style={{ flex: 1 }} />
    </div>
  );
}

/* ─── UI Components ─── */
function UIButtonShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#3b82f6');
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <button style={{ padding: '8px 20px', borderRadius: '6px', background: c, color: '#fff', border: 'none', fontSize: '14px', fontWeight: 600, cursor: 'default', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }} /> : label}
      </button>
    </div>
  );
}

function UIInputShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#8b5cf6');
  const dc = darken(c, 40);
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: width - 4, height: height - 8, border: `2px solid ${dc}`, borderRadius: '4px', background: '#fff', display: 'flex', alignItems: 'center', padding: '0 10px', fontSize: '13px', color: '#94a3b8' }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '13px', color: '#94a3b8' }} /> : label}
        <span style={{ width: 1, height: 16, background: dc, marginLeft: 2, animation: 'blink 1s steps(2) infinite' }} />
      </div>
    </div>
  );
}

function UILabelShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#64748b');
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '14px', fontWeight: 500, color: c }} /> : <span style={{ fontSize: '14px', fontWeight: 500, color: c }}>{label}</span>}
    </div>
  );
}

function UIImageShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#10b981');
  const dc = darken(c, 40);
  return (
    <div style={{ width, height, border: `2px solid ${dc}`, borderRadius: '4px', background: `${c}15`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={dc} strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
      <span style={{ fontSize: '11px', color: TEXT, marginTop: 4 }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '11px', color: TEXT }} /> : label}
      </span>
    </div>
  );
}

function UIContainerShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#f59e0b');
  const dc = darken(c, 40);
  return (
    <div style={{ width, height, border: `2px solid ${dc}`, borderRadius: '8px', background: 'rgba(255,255,255,0.5)', display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
      <div style={{ padding: '4px 10px', fontSize: '12px', fontWeight: 600, color: TEXT, borderBottom: `1px solid ${dc}40`, background: `${c}10` }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '12px', fontWeight: 600, color: TEXT }} /> : label}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#cbd5e1' }}>
        Drop content here
      </div>
    </div>
  );
}

function UIWindowShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#64748b');
  const dc = darken(c, 40);
  return (
    <div style={{ width, height, border: `2px solid ${dc}`, borderRadius: '6px', background: '#fff', display: 'flex', flexDirection: 'column', pointerEvents: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
      <div style={{ height: 28, background: dc, opacity: 0.15, borderBottom: `1px solid ${dc}`, borderRadius: '4px 4px 0 0', display: 'flex', alignItems: 'center', padding: '0 8px', gap: 6 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b' }} />
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
        <span style={{ marginLeft: 8, fontSize: '12px', fontWeight: 600, color: TEXT }}>
          {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '12px', fontWeight: 600, color: TEXT }} /> : label}
        </span>
      </div>
      <div style={{ flex: 1, padding: '8px', fontSize: '12px', color: '#94a3b8' }}>Window content area</div>
    </div>
  );
}

function UIModalShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#ef4444');
  const dc = darken(c, 40);
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: width - 20, height: height - 20, border: `2px solid ${dc}`, borderRadius: '8px', background: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 12px', fontSize: '14px', fontWeight: 700, color: TEXT, borderBottom: `1px solid ${dc}40` }}>
          {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '14px', fontWeight: 700, color: TEXT }} /> : label}
        </div>
        <div style={{ flex: 1, padding: '8px 12px', fontSize: '12px', color: '#64748b' }}>Are you sure you want to proceed?</div>
        <div style={{ padding: '8px 12px', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <div style={{ padding: '4px 12px', borderRadius: '4px', background: '#e5e7eb', fontSize: '12px', color: '#475569' }}>Cancel</div>
          <div style={{ padding: '4px 12px', borderRadius: '4px', background: c, fontSize: '12px', color: '#fff' }}>OK</div>
        </div>
      </div>
    </div>
  );
}

function UICheckboxShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#3b82f6');
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', pointerEvents: 'none' }}>
      <div style={{ width: 18, height: 18, borderRadius: '4px', border: `2px solid ${c}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={c} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 6l3 3 5-6" />
        </svg>
      </div>
      {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '13px', color: TEXT }} /> : <span style={{ fontSize: '13px', color: TEXT }}>{label}</span>}
    </div>
  );
}

function UIComboboxShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#8b5cf6');
  const dc = darken(c, 40);
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      <div style={{ width: width - 4, height: height - 8, border: `2px solid ${dc}`, borderRadius: '4px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', fontSize: '13px', color: TEXT }}>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '13px', color: TEXT }} /> : <span>{label}</span>}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={dc} strokeWidth="2"><path d="M3 5l4 4 4-4" /></svg>
      </div>
    </div>
  );
}

function UIListboxShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#06b6d4');
  const dc = darken(c, 40);
  const items = label.split(',').map(s => s.trim()).slice(0, 5);
  return (
    <div style={{ width, height, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
      <div style={{ width, height, border: `2px solid ${dc}`, borderRadius: '4px', background: '#fff', overflow: 'hidden' }}>
        {items.map((item, i) => (
          <div key={i} style={{ padding: '4px 10px', fontSize: '12px', color: TEXT, borderBottom: i < items.length - 1 ? `1px solid ${dc}20` : 'none', background: i === 0 ? `${c}15` : 'transparent' }}>
            {i === 0 && onEditLabel ? <InlineEditableText text={item} onEdit={(v) => onEditLabel(items.map((it, j) => j === i ? v : it).join(', '))} style={{ fontSize: '12px', color: TEXT }} /> : item}
          </div>
        ))}
      </div>
    </div>
  );
}

function UIRadioShape({ color, label, width, height, onEditLabel }: { color: string; label: string; width: number; height: number; onEditLabel?: (v: string) => void }) {
  const c = safeColor(color, '#ec4899');
  return (
    <div style={{ width, height, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', pointerEvents: 'none' }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${c}`, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
      </div>
      {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '13px', color: TEXT }} /> : <span style={{ fontSize: '13px', color: TEXT }}>{label}</span>}
    </div>
  );
}

/* ─── Component shape (UML component with tabs) ─── */
function ComponentShape({ color, label, width, height, variant, data, onEditLabel, onEditAttrs }: { color: string; label: string; width: number; height: number; variant?: string; data: DiagramNodeData; onEditLabel?: (v: string) => void; onEditAttrs?: (v: string[]) => void }) {
  const c = safeColor(color, '#6ee7b7');
  const dc = darken(c, 60);
  const hasAttr = variant !== 'no-attribute';
  const attrs = data.attrs || [];
  const stereotype = hasAttr ? '«component»' : '«Annotation»';
  return (
    <div style={{ width, minHeight: height, position: 'relative', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, border: `2px solid ${dc}`, borderRadius: '6px', background: c, opacity: 0.85 }} />
      {hasAttr && (
        <>
          <div style={{ position: 'absolute', left: -14, top: '25%', width: 14, height: 12, border: `2px solid ${dc}`, background: '#fff', borderRadius: '2px' }} />
          <div style={{ position: 'absolute', right: -14, top: '25%', width: 14, height: 12, border: `2px solid ${dc}`, background: '#fff', borderRadius: '2px' }} />
          <div style={{ position: 'absolute', left: -14, top: '55%', width: 14, height: 12, border: `2px solid ${dc}`, background: '#fff', borderRadius: '2px' }} />
          <div style={{ position: 'absolute', right: -14, top: '55%', width: 14, height: 12, border: `2px solid ${dc}`, background: '#fff', borderRadius: '2px' }} />
        </>
      )}
      <div style={{ position: 'relative', padding: '4px 8px', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: dc, marginBottom: 2 }}>{stereotype}</div>
        {onEditLabel ? <InlineEditableText text={label} onEdit={onEditLabel} style={{ fontSize: '13px', fontWeight: 500, color: TEXT }} /> : label}
      </div>
      {hasAttr && (
        <div style={{ position: 'relative', padding: '2px 8px 4px', fontSize: '12px', color: TEXT, borderTop: `1px solid ${dc}60` }}>
          {onEditAttrs ? (
            <EditableList items={attrs} onEdit={onEditAttrs} placeholder="No attributes" itemStyle={{ color: TEXT, fontSize: '12px' }} addLabel="Attribute" />
          ) : attrs.length > 0 ? attrs.map((a, i) => <div key={i}>{a}</div>) : null}
        </div>
      )}
    </div>
  );
}

/* ─── Main ShapeRenderer ─── */
function ShapeRenderer({ shape, color, label, width, height, variant, data, lanes, onUpdateLanes, onEditLabel, onEditLaneLabel, onEditFields, onEditMethods, onEditAttrs, onEditColumns }: {
  shape: NodeShape;
  color: string;
  label: string;
  width: number;
  height: number;
  variant?: string;
  data: DiagramNodeData;
  lanes?: Swimlane[];
  onUpdateLanes?: (lanes: Swimlane[]) => void;
  onEditLabel?: (v: string) => void;
  onEditLaneLabel?: (laneId: string, v: string) => void;
  onEditFields?: (v: string[]) => void;
  onEditMethods?: (v: string[]) => void;
  onEditAttrs?: (v: string[]) => void;
  onEditColumns?: (v: { name: string; isPK: boolean }[]) => void;
}) {
  const c = safeColor(color);
  const dc = darken(c, 60);
  switch (shape) {
    case 'ellipse':
      return (
        <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
            <ellipse cx={width / 2} cy={height / 2} rx={width / 2 - 1} ry={height / 2 - 1} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
          </svg>
          <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative' }} />
        </div>
      );
    case 'diamond':
      return (
        <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
            <path d={`M ${width / 2} 0 L ${width} ${height / 2} L ${width / 2} ${height} L 0 ${height / 2} Z`} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
          </svg>
          <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative' }} />
        </div>
      );
    case 'hexagon':
      return (
        <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
            <path d={`M ${width * 0.2} 0 L ${width * 0.8} 0 L ${width} ${height / 2} L ${width * 0.8} ${height} L ${width * 0.2} ${height} L 0 ${height / 2} Z`} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
          </svg>
          <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative' }} />
        </div>
      );
    case 'parallelogram':
      return (
        <div style={{ width, height, position: 'relative', pointerEvents: 'none' }}>
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0 }}>
            <path d={`M ${width * 0.15} 0 L ${width} 0 L ${width * 0.85} ${height} L 0 ${height} Z`} fill={c} fillOpacity={0.85} stroke={dc} strokeWidth={2} />
          </svg>
          <EditableNodeLabel label={label} onEditLabel={onEditLabel} extraStyle={{ position: 'relative' }} />
        </div>
      );
    case 'cylinder':
      return <DatabaseShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'actor':
      return <ActorShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'component':
      return <ComponentShape color={color} label={label} width={width} height={height} variant={variant} data={data} onEditLabel={onEditLabel} onEditAttrs={onEditAttrs} />;
    case 'note':
      return <NoteShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'bar':
      return <BarShape color={color} width={width} height={height} />;
    case 'cancel':
      return <CancelShape color={color} width={width} height={height} />;
    case 'partition-h':
      return <SwimlanePoolHShape color={color} label={label} width={width} height={height} lanes={lanes || [{ id: 'lane_1', label: 'Lane 1' }, { id: 'lane_2', label: 'Lane 2' }]} onUpdateLanes={onUpdateLanes} onEditLabel={onEditLabel} onEditLaneLabel={onEditLaneLabel} />;
    case 'partition-v':
      return <SwimlanePoolVShape color={color} label={label} width={width} height={height} lanes={lanes || [{ id: 'lane_1', label: 'Lane 1' }, { id: 'lane_2', label: 'Lane 2' }]} onUpdateLanes={onUpdateLanes} onEditLabel={onEditLabel} onEditLaneLabel={onEditLaneLabel} />;
    case 'dowhile':
      return <DoWhileShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'class-box':
      return <ClassBoxShape color={color} label={label} width={width} height={height} variant={variant} data={data} onEditLabel={onEditLabel} onEditFields={onEditFields} onEditMethods={onEditMethods} />;
    case 'object-box':
      return <ObjectBoxShape color={color} label={label} width={width} height={height} data={data} onEditLabel={onEditLabel} />;
    case 'package':
      return <PackageShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'provided-interface':
      return <ProvidedInterfaceShape color={color} width={width} height={height} />;
    case 'required-interface':
      return <RequiredInterfaceShape color={color} width={width} height={height} rotation={data.rotation as number | undefined} />;
    case 'lifeline':
      return <LifelineShape color={color} label={label} width={width} height={height} />;
    case 'activation-box':
      return <ActivationBoxShape color={color} width={width} height={height} />;
    case 'table':
      return <TableShape color={color} label={label} width={width} height={height} data={data} onEditLabel={onEditLabel} onEditColumns={onEditColumns} />;
    case 'comment-link':
      return <CommentLinkShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'print':
      return <PrintShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'card':
      return <CardShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'manual-input':
      return <ManualInputShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'predefined-process':
      return <PredefinedProcessShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'on-page-ref':
      return <OnPageRefShape color={color} label={label} width={width} height={height} />;
    case 'off-page-ref':
      return <OffPageRefShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'display':
      return <DisplayShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'database':
      return <DatabaseShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'system-boundary':
      return <SystemBoundaryShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-button':
      return <UIButtonShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-input':
      return <UIInputShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-label':
      return <UILabelShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-image':
      return <UIImageShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-container':
      return <UIContainerShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-window':
      return <UIWindowShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-modal':
      return <UIModalShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-checkbox':
      return <UICheckboxShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-combobox':
      return <UIComboboxShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-listbox':
      return <UIListboxShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'ui-radio':
      return <UIRadioShape color={color} label={label} width={width} height={height} onEditLabel={onEditLabel} />;
    case 'rounded':
      return (
        <div style={{ width, height, borderRadius: '12px', background: c, opacity: 0.85, border: `2px solid ${dc}`, pointerEvents: 'none' }}>
          <EditableNodeLabel label={label} onEditLabel={onEditLabel} />
        </div>
      );
    case 'rect':
    default:
      return (
        <div style={{ width, height, borderRadius: '4px', background: c, opacity: 0.85, border: `2px solid ${dc}`, pointerEvents: 'none' }}>
          <EditableNodeLabel label={label} onEditLabel={onEditLabel} />
        </div>
      );
  }
}

/* ─── Inline editable text (for swimlane labels) ─── */
function InlineEditableText({ text, onEdit, style, editStyle }: {
  text: string;
  onEdit: (v: string) => void;
  style?: React.CSSProperties;
  editStyle?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(text);

  const commit = useCallback(() => {
    setEditing(false);
  }, []);

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          onEdit(v);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setEditing(false); setValue(text); onEdit(text); }
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className="nodrag"
        style={{
          width: '100%',
          border: '1px solid #3b82f6',
          borderRadius: '3px',
          padding: '2px 4px',
          fontSize: 'inherit',
          fontWeight: 'inherit',
          textAlign: 'center',
          background: 'transparent',
          color: 'inherit',
          pointerEvents: 'all',
          outline: 'none',
          writingMode: 'horizontal-tb' as const,
          transform: 'none',
          ...style,
          ...editStyle,
        }}
      />
    );
  }

  return (
    <span
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      style={{ cursor: 'text', pointerEvents: 'all', minHeight: '1em', minWidth: '2em', display: 'inline-block', ...style }}
    >
      {text || '\u00A0'}
    </span>
  );
}

/* ─── Editable list (for fields, methods, attrs) ─── */
function EditableList({ items, onEdit, placeholder, itemStyle, addLabel }: {
  items: string[];
  onEdit: (items: string[]) => void;
  placeholder: string;
  itemStyle?: React.CSSProperties;
  addLabel?: string;
}) {
  const removeItem = (e: React.MouseEvent, i: number) => {
    e.stopPropagation();
    onEdit(items.filter((_, j) => j !== i));
  };
  const addItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    const base = (addLabel || 'Item').toLowerCase();
    onEdit([...items, `${base} ${items.length + 1}`]);
  };

  return (
    <div style={{ pointerEvents: 'none' }}>
      {items.length > 0 ? items.map((item, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'none' }}>
          <div style={{ flex: 1, pointerEvents: 'none' }}>
            <InlineEditableText
              text={item}
              onEdit={(v) => onEdit(items.map((it, j) => j === i ? v : it))}
              style={itemStyle}
            />
          </div>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => removeItem(e, i)}
            className="nodrag"
            style={{
              flexShrink: 0, width: 16, height: 16, border: 'none', borderRadius: '50%',
              background: '#ef4444', color: '#fff', fontSize: '10px', cursor: 'pointer',
              pointerEvents: 'all', display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: 0,
            }}
          >×</button>
        </div>
      )) : (
        <div style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>{placeholder}</div>
      )}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={addItem}
        className="nodrag"
        style={{
          marginTop: 2, border: 'none', background: 'transparent', color: '#3b82f6',
          fontSize: '11px', cursor: 'pointer', pointerEvents: 'all', padding: '2px 0',
          display: 'flex', alignItems: 'center', gap: 2,
        }}
      >+ {addLabel || 'Add'}</button>
    </div>
  );
}

function DiagramNode({ data, id, selected, width: nodeWidth, height: nodeHeight }: NodeProps) {
  const nodeData = data as unknown as DiagramNodeData;
  const { label, nodeType } = nodeData;
  const width = nodeWidth || nodeType.defaultWidth || 140;
  const isConnecting = useContext(ConnectionContext);
  const showHandles = selected || isConnecting;
  const height = nodeHeight || nodeType.defaultHeight || 60;
  const { setNodes, setEdges } = useNodeUpdaters();
  const nodeRef = useRef<HTMLDivElement>(null);
  const lastSize = useRef<{ w: number; h: number }>({ w: width, h: height });

  useEffect(() => {
    if (!nodeRef.current) return;
    const el = nodeRef.current;
    const observer = new ResizeObserver((entries) => {
      const cr = entries[0].contentRect;
      const newW = Math.round(cr.width);
      const newH = Math.round(cr.height);
      const { w, h } = lastSize.current;
      if (Math.abs(newW - w) > 2 || Math.abs(newH - h) > 2) {
        lastSize.current = { w: newW, h: newH };
        setNodes((nds: Node[]) =>
          nds.map((n) => n.id === id ? { ...n, width: newW, height: newH } : n)
        );
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [id, setNodes]);

  const handleLabelEdit = useCallback((newLabel: string) => {
    setNodes((nds: Node[]) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label: newLabel } } : n
      )
    );
  }, [id, setNodes]);

  const handleUpdateLanes = useCallback((lanes: Swimlane[]) => {
    setNodes((nds: Node[]) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, lanes } } : n
      )
    );
  }, [id, setNodes]);

  const handleEditLaneLabel = useCallback((laneId: string, newLabel: string) => {
    setNodes((nds: Node[]) =>
      nds.map((n) => {
        if (n.id !== id) return n;
        const nd = n.data as unknown as DiagramNodeData;
        const currentLanes = nd.lanes || [];
        const lanes = currentLanes.map(l => l.id === laneId ? { ...l, label: newLabel } : l);
        return { ...n, data: { ...n.data, lanes } };
      })
    );
  }, [id, setNodes]);

  const handleDelete = useCallback(() => {
    setNodes((nds: Node[]) => nds.filter((n) => n.id !== id));
    setEdges((eds: any[]) => eds.filter((e) => e.source !== id && e.target !== id));
  }, [id, setNodes, setEdges]);

  const handleEditFields = useCallback((fields: string[]) => {
    setNodes((nds: Node[]) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, fields } } : n));
  }, [id, setNodes]);

  const handleEditMethods = useCallback((methods: string[]) => {
    setNodes((nds: Node[]) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, methods } } : n));
  }, [id, setNodes]);

  const handleEditAttrs = useCallback((attrs: string[]) => {
    setNodes((nds: Node[]) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, attrs } } : n));
  }, [id, setNodes]);

  const handleEditColumns = useCallback((columns: { name: string; isPK: boolean }[]) => {
    setNodes((nds: Node[]) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, tableColumns: columns } } : n));
  }, [id, setNodes]);

  const handleRotate = useCallback(() => {
    setNodes((nds: Node[]) => nds.map((n) => {
      if (n.id !== id) return n;
      const nd = n.data as unknown as DiagramNodeData;
      const current = nd.rotation || 0;
      return { ...n, data: { ...n.data, rotation: (current + 90) % 360 } };
    }));
  }, [id, setNodes]);

  const isSwimlane = nodeType.shape === 'partition-h' || nodeType.shape === 'partition-v';

  useEffect(() => {
    if (isSwimlane && !nodeData.lanes) {
      setNodes((nds: Node[]) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, lanes: [{ id: `lane_${Date.now()}_1`, label: 'Lane 1' }, { id: `lane_${Date.now()}_2`, label: 'Lane 2' }] } } : n
        )
      );
    }
  }, [isSwimlane, nodeData.lanes, id, setNodes]);

  const handleOffsets = (() => {
    const shape = nodeType.shape;
    if (shape === 'provided-interface' || shape === 'required-interface') {
      const s = Math.min(width, height) * 0.6;
      const dx = (width - s) / 2;
      const dy = (height - s) / 2;
      return { top: dy, bottom: dy, left: dx, right: dx };
    }
    if (shape === 'actor') {
      const actorW = 40;
      const dx = (width - actorW) / 2;
      return { top: 0, bottom: 0, left: dx, right: dx };
    }
    if (shape === 'on-page-ref') {
      const s = Math.min(width, height);
      const dx = (width - s) / 2;
      const dy = (height - s) / 2;
      return { top: dy, bottom: dy, left: dx, right: dx };
    }
    return { top: 0, bottom: 0, left: 0, right: 0 };
  })();

  return (
    <div
      ref={nodeRef}
      style={{
        position: 'relative', width, minHeight: height, pointerEvents: 'all',
        ...(selected ? {
          boxShadow: '0 0 0 2px #3b82f6, 0 0 12px rgba(59,130,246,0.5)',
          borderRadius: '4px',
        } : {}),
      }}
    >
      <NodeResizer
        isVisible={!!selected}
        minWidth={60}
        minHeight={40}
        lineStyle={{ borderColor: '#3b82f6', borderWidth: 1 }}
        handleStyle={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6', border: '2px solid #fff' }}
      />
      {nodeType.hasTargetHandle && (
        <>
          <Handle type="target" position={Position.Top} className={showHandles ? '' : 'handle-hidden'} style={{ top: handleOffsets.top, zIndex: 50 }} />
          <Handle type="target" position={Position.Left} id="left-target" className={showHandles ? '' : 'handle-hidden'} style={{ left: handleOffsets.left, zIndex: 50 }} />
          <Handle type="target" position={Position.Right} id="right-target" className={showHandles ? '' : 'handle-hidden'} style={{ right: handleOffsets.right, zIndex: 50 }} />
        </>
      )}
      <ShapeRenderer
        shape={nodeType.shape}
        color={nodeType.color}
        label={label}
        width={width}
        height={height}
        variant={nodeType.variant}
        data={nodeData}
        lanes={nodeData.lanes}
        onUpdateLanes={handleUpdateLanes}
        onEditLabel={handleLabelEdit}
        onEditLaneLabel={handleEditLaneLabel}
        onEditFields={handleEditFields}
        onEditMethods={handleEditMethods}
        onEditAttrs={handleEditAttrs}
        onEditColumns={handleEditColumns}
      />
      {nodeType.hasSourceHandle && (
        <>
          <Handle type="source" position={Position.Bottom} className={showHandles ? '' : 'handle-hidden'} style={{ bottom: handleOffsets.bottom, zIndex: 50 }} />
          <Handle type="source" position={Position.Left} id="left-source" className={showHandles ? '' : 'handle-hidden'} style={{ left: handleOffsets.left, zIndex: 50 }} />
          <Handle type="source" position={Position.Right} id="right-source" className={showHandles ? '' : 'handle-hidden'} style={{ right: handleOffsets.right, zIndex: 50 }} />
        </>
      )}
      {selected && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); handleDelete(); }}
          style={{
            position: 'absolute', top: -10, right: -10, width: 22, height: 22,
            borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff',
            fontSize: '14px', cursor: 'pointer', zIndex: 30, pointerEvents: 'all',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', boxSizing: 'border-box',
          }}
        ><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M2 2L8 8M8 2L2 8" /></svg></button>
      )}
      {selected && nodeType.shape === 'required-interface' && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); handleRotate(); }}
          title="Rotate 90°"
          style={{
            position: 'absolute', top: -10, right: -38, width: 22, height: 22,
            borderRadius: '50%', border: 'none', background: '#3b82f6', color: '#fff',
            cursor: 'pointer', zIndex: 30, pointerEvents: 'all',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', boxSizing: 'border-box',
          }}
        ><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg></button>
      )}
    </div>
  );
}

export default memo(DiagramNode);

/* ─── Custom Edge with selection glow + delete button ─── */

function DiamondMarker({ x, y, filled, angle }: { x: number; y: number; filled: boolean; angle: number }) {
  const size = 8;
  const w = size * 2 + 4;
  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          pointerEvents: 'none',
        }}
      >
        <svg
          width={w}
          height={w}
          style={{ overflow: 'visible', display: 'block' }}
        >
          <g transform={`rotate(${angle} ${w / 2} ${w / 2})`}>
            <path
              d={`M${w / 2},2 L${w - 2},${w / 2} L${w / 2},${w - 2} L2,${w / 2} Z`}
              fill={filled ? '#475569' : '#fff'}
              stroke="#475569"
              strokeWidth="1.5"
            />
          </g>
        </svg>
      </div>
    </EdgeLabelRenderer>
  );
}

function CrowFootMarker({ x, y, markerType, angle }: { x: number; y: number; markerType: string; angle: number }) {
  const w = 24;
  const h = 24;
  const stroke = '#475569';
  const sw = 1.5;
  const cx = w / 2;
  const cy = h / 2;

  let paths: React.ReactNode = null;
  if (markerType === 'crow-one') {
    paths = <line x1={cx} y1={2} x2={cx} y2={h - 2} stroke={stroke} strokeWidth={sw} />;
  } else if (markerType === 'crow-many') {
    paths = (
      <>
        <line x1={cx} y1={cy} x2={w - 2} y2={2} stroke={stroke} strokeWidth={sw} />
        <line x1={cx} y1={cy} x2={w - 2} y2={cy} stroke={stroke} strokeWidth={sw} />
        <line x1={cx} y1={cy} x2={w - 2} y2={h - 2} stroke={stroke} strokeWidth={sw} />
      </>
    );
  } else if (markerType === 'crow-optional') {
    paths = (
      <>
        <circle cx={cx + 4} cy={cy} r={4} fill="none" stroke={stroke} strokeWidth={sw} />
        <line x1={cx + 8} y1={cy} x2={w - 2} y2={2} stroke={stroke} strokeWidth={sw} />
        <line x1={cx + 8} y1={cy} x2={w - 2} y2={cy} stroke={stroke} strokeWidth={sw} />
        <line x1={cx + 8} y1={cy} x2={w - 2} y2={h - 2} stroke={stroke} strokeWidth={sw} />
      </>
    );
  } else if (markerType === 'crow-mandatory') {
    paths = (
      <>
        <line x1={cx + 4} y1={2} x2={cx + 4} y2={h - 2} stroke={stroke} strokeWidth={sw} />
        <line x1={cx + 8} y1={cy} x2={w - 2} y2={2} stroke={stroke} strokeWidth={sw} />
        <line x1={cx + 8} y1={cy} x2={w - 2} y2={cy} stroke={stroke} strokeWidth={sw} />
        <line x1={cx + 8} y1={cy} x2={w - 2} y2={h - 2} stroke={stroke} strokeWidth={sw} />
      </>
    );
  }

  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
          pointerEvents: 'none',
        }}
      >
        <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
          <g transform={`rotate(${angle} ${cx} ${cy})`}>
            {paths}
          </g>
        </svg>
      </div>
    </EdgeLabelRenderer>
  );
}

export function DiagramEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  style, markerEnd, markerStart, selected, data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });
  const { setEdges } = useReactFlow();

  const handleDelete = useCallback(() => {
    setEdges((eds: any[]) => eds.filter((e) => e.id !== id));
  }, [id, setEdges]);

  const edgeLabel = (data as any)?.edgeLabel;
  const diamondMarkerType = (data as any)?.diamondMarker;
  const diamondFilled = diamondMarkerType === 'diamond-filled';
  const diamondHollow = diamondMarkerType === 'diamond-hollow';
  const sourceCrowMarker = (data as any)?.sourceCrowMarker;
  const targetCrowMarker = (data as any)?.targetCrowMarker;
  const hasSourceCrow = sourceCrowMarker && sourceCrowMarker !== 'none';
  const hasTargetCrow = targetCrowMarker && targetCrowMarker !== 'none';

  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const reverseAngle = angle + 180;

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={undefined}
        markerStart={undefined}
        style={{
          ...style,
          ...(selected ? {
            stroke: '#3b82f6',
            strokeWidth: 3,
            filter: 'drop-shadow(0 0 6px rgba(59,130,246,0.6))',
          } : {}),
        }}
      />
      {(diamondHollow || diamondFilled) && (
        <DiamondMarker x={targetX} y={targetY} filled={diamondFilled} angle={angle} />
      )}
      {hasSourceCrow && (
        <CrowFootMarker x={sourceX} y={sourceY} markerType={sourceCrowMarker} angle={reverseAngle} />
      )}
      {hasTargetCrow && (
        <CrowFootMarker x={targetX} y={targetY} markerType={targetCrowMarker} angle={angle} />
      )}
      {edgeLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: 'none',
              background: '#fff',
              padding: '2px 6px',
              fontSize: '11px',
              fontStyle: 'italic',
              color: '#475569',
              borderRadius: '3px',
              border: '1px solid #cbd5e1',
            }}
          >{edgeLabel}</div>
        </EdgeLabelRenderer>
      )}
      {selected && (
        <EdgeLabelRenderer>
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY - 20}px)`,
              pointerEvents: 'all',
              width: 22, height: 22, borderRadius: '50%',
              border: 'none', background: '#ef4444', color: '#fff',
              fontSize: '14px', cursor: 'pointer', zIndex: 30,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1, padding: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', boxSizing: 'border-box',
            }}
          ><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M2 2L8 8M8 2L2 8" /></svg></button>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
