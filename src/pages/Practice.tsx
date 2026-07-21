import { useCallback, useRef, useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  type EdgeTypes,
  type OnConnect,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  PanOnScrollMode,
  type ReactFlowInstance,
} from '@xyflow/react';
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Undo2, Redo2 } from 'lucide-react';
import { DIAGRAM_TYPES, type NodeTypeDefinition, type DiagramType, type EdgeTypeDefinition } from '../data/diagramTypes';
import { getQuestionsByType } from '../data/questions';
import DiagramNode, { DiagramEdge, type DiagramNodeData, NodeUpdateContext, ConnectionContext } from '../components/DiagramNode';
import Palette from '../components/Palette';
import QuestionPanel from '../components/QuestionPanel';

let nodeIdCounter = 0;

function PracticeCanvas() {
  const { diagramType } = useParams<{ diagramType: string }>();
  const navigate = useNavigate();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);

  const diagramInfo = DIAGRAM_TYPES.find(d => d.id === diagramType);
  const questions = useMemo(() => {
    if (!diagramType) return [];
    return getQuestionsByType(diagramType as DiagramType);
  }, [diagramType]);

  const currentQuestion = questions[questionIndex];

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // ─── Undo/Redo History ───
  const pastRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const futureRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const lastCommittedRef = useRef<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const isUndoRedoRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, forceHistoryUpdate] = useState(0);

  useEffect(() => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      lastCommittedRef.current = { nodes: [...nodes], edges: [...edges] };
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Skip if nothing actually changed
      const last = lastCommittedRef.current;
      if (JSON.stringify(last.nodes) === JSON.stringify(nodes) && JSON.stringify(last.edges) === JSON.stringify(edges)) return;
      pastRef.current.push({ nodes: [...last.nodes], edges: [...last.edges] });
      futureRef.current = [];
      lastCommittedRef.current = { nodes: [...nodes], edges: [...edges] };
      forceHistoryUpdate((x) => x + 1);
    }, 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nodes, edges]);

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return;
    const pastState = pastRef.current.pop()!;
    futureRef.current.unshift({ nodes: [...nodes], edges: [...edges] });
    isUndoRedoRef.current = true;
    lastCommittedRef.current = { nodes: [...pastState.nodes], edges: [...pastState.edges] };
    setNodes(pastState.nodes);
    setEdges(pastState.edges);
    forceHistoryUpdate((x) => x + 1);
  }, [nodes, edges, setNodes, setEdges]);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const futureState = futureRef.current.shift()!;
    pastRef.current.push({ nodes: [...nodes], edges: [...edges] });
    isUndoRedoRef.current = true;
    lastCommittedRef.current = { nodes: [...futureState.nodes], edges: [...futureState.edges] };
    setNodes(futureState.nodes);
    setEdges(futureState.edges);
    forceHistoryUpdate((x) => x + 1);
  }, [nodes, edges, setNodes, setEdges]);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const nodeTypes: NodeTypes = useMemo(() => ({
    diagramNode: DiagramNode,
  }), []);

  const edgeTypes: EdgeTypes = useMemo(() => ({
    default: DiagramEdge,
  }), []);

  const nodeUpdateValue = useMemo(() => ({ setNodes, setEdges }), [setNodes, setEdges]);

  const [selectedEdgeType, setSelectedEdgeType] = useState<EdgeTypeDefinition | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const onConnectStart = useCallback(() => setIsConnecting(true), []);
  const onConnectEnd = useCallback(() => setIsConnecting(false), []);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const edgeType = selectedEdgeType;
      const style: React.CSSProperties = {
        stroke: '#475569',
        strokeWidth: 2,
        strokeDasharray: edgeType?.lineStyle === 'dashed' ? '8 4' : edgeType?.lineStyle === 'dotted' ? '2 4' : undefined,
      };
      const markerEnd = edgeType?.targetMarker === 'arrow-filled' ? { type: 'arrowclosed' as const } :
        edgeType?.targetMarker === 'arrow' ? { type: 'arrow' as const } :
        edgeType?.targetMarker === 'none' ? undefined :
        { type: 'arrowclosed' as const };
      const diamondMarker = edgeType?.sourceMarker === 'diamond' ? 'diamond-hollow' :
        edgeType?.sourceMarker === 'diamond-filled' ? 'diamond-filled' :
        undefined;
      const sourceCrowMarker = edgeType?.sourceMarker?.startsWith('crow-') ? edgeType.sourceMarker : undefined;
      const targetCrowMarker = edgeType?.targetMarker?.startsWith('crow-') ? edgeType.targetMarker : undefined;
      setEdges((eds) => addEdge({
        ...connection,
        animated: false,
        style,
        markerEnd,
        data: { edgeType: edgeType?.type, edgeLabel: edgeType?.edgeLabel, diamondMarker, sourceCrowMarker, targetCrowMarker },
      }, eds));
    },
    [setEdges, selectedEdgeType]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      if (!rfInstance) return;

      const typeStr = event.dataTransfer.getData('application/reactflow');
      if (!typeStr) return;

      const nodeType: NodeTypeDefinition = JSON.parse(typeStr);
      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode: Node<DiagramNodeData> = {
        id: `node_${nodeIdCounter++}`,
        type: 'diagramNode',
        position,
        selected: true,
        data: {
          label: nodeType.label,
          nodeType,
          ...(nodeType.shape === 'partition-h' || nodeType.shape === 'partition-v'
            ? { lanes: [{ id: `lane_${Date.now()}_1`, label: 'Lane 1' }, { id: `lane_${Date.now()}_2`, label: 'Lane 2' }] }
            : {}),
        },
      };

      setNodes((nds) =>
        nds.map((n) => ({ ...n, selected: false } as Node)).concat(newNode)
      );
    },
    [rfInstance, setNodes]
  );

  const handleReset = useCallback(() => {
    setNodes([]);
    setEdges([]);
    pastRef.current = [];
    futureRef.current = [];
    lastCommittedRef.current = { nodes: [], edges: [] };
    forceHistoryUpdate((x) => x + 1);
  }, [setNodes, setEdges]);

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setQuestionIndex(index);
      handleReset();
    }
  };

  if (!diagramInfo || !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Diagram type or question not found.</p>
          <Link to="/" className="text-topcit-600 hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={18} />
            Home
          </button>
          <div className="w-px h-6 bg-gray-200" />
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: `${diagramInfo.color}20` }}
            >
              <FileText size={16} style={{ color: diagramInfo.color }} />
            </div>
            <span className="text-sm font-semibold text-gray-800">{diagramInfo.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 size={18} className="text-gray-600" />
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Redo2 size={18} className="text-gray-600" />
            </button>
          </div>
          <div className="w-px h-6 bg-gray-200" />
          <span className="text-sm text-gray-500">
            Question {questionIndex + 1} of {questions.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => goToQuestion(questionIndex - 1)}
              disabled={questionIndex === 0}
              className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <button
              onClick={() => goToQuestion(questionIndex + 1)}
              disabled={questionIndex === questions.length - 1}
              className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <Palette
          nodeTypes={diagramInfo.nodeTypes}
          edgeTypes={diagramInfo.edgeTypes}
          diagramType={diagramInfo.id}
          selectedEdgeType={selectedEdgeType}
          onSelectEdgeType={setSelectedEdgeType}
        />

        <div ref={reactFlowWrapper} className="flex-1 relative">
          <NodeUpdateContext.Provider value={nodeUpdateValue}>
          <ConnectionContext.Provider value={isConnecting}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onConnectStart={onConnectStart}
            onConnectEnd={onConnectEnd}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            nodesDraggable
            nodesConnectable
            nodesFocusable
            elementsSelectable
            fitView
            proOptions={{ hideAttribution: true }}
            panOnScroll
            panOnScrollMode={PanOnScrollMode.Free}
            zoomOnScroll={false}
            zoomOnPinch
            panOnDrag
            selectionOnDrag
            defaultEdgeOptions={{
              style: { stroke: '#475569', strokeWidth: 2 },
              markerEnd: { type: 'arrowclosed' as const },
            }}
          >
            <Background color="#cbd5e1" gap={20} size={1.5} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as DiagramNodeData;
                return data?.nodeType?.color || '#94a3b8';
              }}
              maskColor="rgba(0,0,0,0.05)"
            />
          </ReactFlow>
          </ConnectionContext.Provider>
          </NodeUpdateContext.Provider>
        </div>

        <QuestionPanel
          question={currentQuestion}
          nodes={nodes}
          edges={edges}
          onReset={handleReset}
        />
      </div>
    </div>
  );
}

export default function Practice() {
  return (
    <ReactFlowProvider>
      <PracticeCanvas />
    </ReactFlowProvider>
  );
}
