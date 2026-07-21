export type DiagramType =
  | 'activity'
  | 'flowchart'
  | 'class'
  | 'sequence'
  | 'component'
  | 'ui'
  | 'er'
  | 'usecase';

export type NodeShape =
  | 'rect' | 'rounded' | 'ellipse' | 'diamond' | 'hexagon' | 'cylinder'
  | 'parallelogram' | 'actor' | 'component' | 'note' | 'bar' | 'bar-vertical'
  | 'cancel' | 'partition-h' | 'partition-v' | 'dowhile'
  | 'class-box' | 'object-box' | 'package' | 'provided-interface' | 'required-interface'
  | 'lifeline' | 'activation-box'
  | 'table' | 'crow-foot' | 'comment-link'
  | 'print' | 'card' | 'manual-input' | 'predefined-process' | 'on-page-ref' | 'off-page-ref' | 'display' | 'database'
  | 'ui-button' | 'ui-input' | 'ui-label' | 'ui-image' | 'ui-container' | 'ui-window' | 'ui-modal'
  | 'ui-checkbox' | 'ui-combobox' | 'ui-listbox' | 'ui-radio'
  | 'system-boundary';

export interface EdgeTypeDefinition {
  type: string;
  label: string;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  sourceMarker?: 'none' | 'diamond-filled' | 'diamond' | 'circle' | 'arrow' | 'crow-one' | 'crow-many' | 'crow-optional' | 'crow-mandatory';
  targetMarker: 'none' | 'arrow' | 'arrow-filled' | 'diamond-filled' | 'diamond' | 'circle' | 'circle-filled' | 'crow-one' | 'crow-many' | 'crow-optional' | 'crow-mandatory';
  edgeLabel?: string;
}

export interface DiagramTypeInfo {
  id: DiagramType;
  name: string;
  description: string;
  icon: string;
  color: string;
  nodeTypes: NodeTypeDefinition[];
  edgeTypes?: EdgeTypeDefinition[];
}

export interface NodeTypeDefinition {
  type: string;
  label: string;
  icon: string;
  color: string;
  shape: NodeShape;
  hasSourceHandle: boolean;
  hasTargetHandle: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
  variant?: string;
  editable?: boolean;
}

export interface Question {
  id: string;
  diagramType: DiagramType;
  title: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  nodes: ExpectedNode[];
  edges: ExpectedEdge[];
  hints: string[];
}

export interface ExpectedNode {
  id: string;
  type: string;
  label: string;
  category: string;
}

export interface ExpectedEdge {
  source: string;
  target: string;
  label?: string;
  edgeType?: string;
}

const ACTIVITY_EDGES: EdgeTypeDefinition[] = [
  { type: 'act-control', label: 'Control Flow', lineStyle: 'solid', targetMarker: 'arrow-filled' },
];

const CLASS_EDGES: EdgeTypeDefinition[] = [
  { type: 'class-association', label: 'Association', lineStyle: 'solid', targetMarker: 'none' },
  { type: 'class-directed-assoc', label: 'Directed Association', lineStyle: 'solid', targetMarker: 'arrow-filled' },
  { type: 'class-aggregation', label: 'Aggregation', lineStyle: 'solid', sourceMarker: 'diamond', targetMarker: 'none' },
  { type: 'class-composition', label: 'Composition', lineStyle: 'solid', sourceMarker: 'diamond-filled', targetMarker: 'none' },
  { type: 'class-generalization', label: 'Generalization', lineStyle: 'solid', targetMarker: 'arrow' },
  { type: 'class-dependency', label: 'Dependency', lineStyle: 'dashed', targetMarker: 'arrow-filled', edgeLabel: '«use»' },
  { type: 'class-realization', label: 'Realization', lineStyle: 'dashed', targetMarker: 'arrow' },
];

const COMPONENT_EDGES: EdgeTypeDefinition[] = [
  { type: 'comp-dependency', label: 'Dependency', lineStyle: 'dashed', targetMarker: 'arrow-filled' },
  { type: 'comp-generalization', label: 'Generalization', lineStyle: 'solid', targetMarker: 'arrow' },
];

const ER_EDGES: EdgeTypeDefinition[] = [
  { type: 'er-one-one', label: 'One-to-One', lineStyle: 'solid', sourceMarker: 'crow-one', targetMarker: 'crow-one' },
  { type: 'er-one-many', label: 'One-to-Many', lineStyle: 'solid', sourceMarker: 'crow-one', targetMarker: 'crow-many' },
  { type: 'er-many-one', label: 'Many-to-One', lineStyle: 'solid', sourceMarker: 'crow-many', targetMarker: 'crow-one' },
  { type: 'er-many-many', label: 'Many-to-Many', lineStyle: 'solid', sourceMarker: 'crow-many', targetMarker: 'crow-many' },
  { type: 'er-one-optional', label: 'One-to-Optional Many', lineStyle: 'solid', sourceMarker: 'crow-one', targetMarker: 'crow-optional' },
  { type: 'er-many-optional', label: 'Many-to-Optional Many', lineStyle: 'solid', sourceMarker: 'crow-many', targetMarker: 'crow-optional' },
  { type: 'er-optional-one', label: 'Optional Many-to-One', lineStyle: 'solid', sourceMarker: 'crow-optional', targetMarker: 'crow-one' },
  { type: 'er-optional-many', label: 'Optional Many-to-Many', lineStyle: 'solid', sourceMarker: 'crow-optional', targetMarker: 'crow-many' },
  { type: 'er-optional-optional', label: 'Optional Many-to-Optional Many', lineStyle: 'solid', sourceMarker: 'crow-optional', targetMarker: 'crow-optional' },
  { type: 'er-mandatory-one', label: 'Mandatory One-to-One', lineStyle: 'solid', sourceMarker: 'crow-mandatory', targetMarker: 'crow-one' },
  { type: 'er-mandatory-many', label: 'Mandatory One-to-Many', lineStyle: 'solid', sourceMarker: 'crow-mandatory', targetMarker: 'crow-many' },
];

const FLOW_EDGES: EdgeTypeDefinition[] = [
  { type: 'flow-control', label: 'Control Flow', lineStyle: 'solid', targetMarker: 'arrow-filled' },
];

const SEQ_EDGES: EdgeTypeDefinition[] = [
  { type: 'seq-sync', label: 'Synchronous Message', lineStyle: 'solid', targetMarker: 'arrow-filled' },
  { type: 'seq-async', label: 'Asynchronous Message', lineStyle: 'solid', targetMarker: 'arrow' },
  { type: 'seq-return', label: 'Return Message', lineStyle: 'dashed', targetMarker: 'arrow' },
  { type: 'seq-self', label: 'Self-Call', lineStyle: 'solid', targetMarker: 'arrow-filled' },
];

const UC_EDGES: EdgeTypeDefinition[] = [
  { type: 'uc-association', label: 'Association', lineStyle: 'solid', targetMarker: 'none' },
  { type: 'uc-directed-assoc', label: 'Directed Association', lineStyle: 'solid', targetMarker: 'arrow-filled' },
  { type: 'uc-dependency', label: 'Dependency', lineStyle: 'dashed', targetMarker: 'arrow-filled' },
  { type: 'uc-include', label: 'Include', lineStyle: 'dashed', targetMarker: 'arrow-filled', edgeLabel: '«include»' },
  { type: 'uc-extend', label: 'Extend', lineStyle: 'dashed', targetMarker: 'arrow-filled', edgeLabel: '«extend»' },
  { type: 'uc-generalization', label: 'Generalization', lineStyle: 'solid', targetMarker: 'arrow' },
];

export const DIAGRAM_TYPES: DiagramTypeInfo[] = [
  {
    id: 'activity',
    name: 'Activity Diagram',
    description: 'Model workflow and business processes with activities, decisions, and flows',
    icon: 'GitBranch',
    color: '#3b82f6',
    edgeTypes: ACTIVITY_EDGES,
    nodeTypes: [
      { type: 'activity-start', label: 'Start', icon: 'Play', color: '#22c55e', shape: 'ellipse', hasSourceHandle: true, hasTargetHandle: false, defaultWidth: 60, defaultHeight: 60 },
      { type: 'activity-end', label: 'End', icon: 'Square', color: '#ef4444', shape: 'ellipse', hasSourceHandle: false, hasTargetHandle: true, defaultWidth: 60, defaultHeight: 60 },
      { type: 'activity-action', label: 'Action', icon: 'Circle', color: '#7dd3fc', shape: 'rounded', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 60 },
      { type: 'activity-decision', label: 'Decision', icon: 'Diamond', color: '#fcd34d', shape: 'diamond', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 120, defaultHeight: 100 },
      { type: 'activity-merge', label: 'Merge', icon: 'GitMerge', color: '#fcd34d', shape: 'diamond', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 120, defaultHeight: 100 },
      { type: 'activity-fork', label: 'Fork', icon: 'Split', color: '#1e293b', shape: 'bar', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 120, defaultHeight: 8 },
      { type: 'activity-join', label: 'Join', icon: 'Combine', color: '#1e293b', shape: 'bar', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 120, defaultHeight: 8 },
      { type: 'activity-cancel', label: 'Cancel', icon: 'XCircle', color: '#ef4444', shape: 'cancel', hasSourceHandle: false, hasTargetHandle: true, defaultWidth: 60, defaultHeight: 60 },
      { type: 'activity-partition-h', label: 'Swimlane Pool (H)', icon: 'Columns3', color: '#64748b', shape: 'partition-h', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 400, defaultHeight: 200 },
      { type: 'activity-partition-v', label: 'Swimlane Pool (V)', icon: 'Rows3', color: '#64748b', shape: 'partition-v', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 300, defaultHeight: 300 },
      { type: 'activity-dowhile', label: 'Do While Loop', icon: 'Repeat', color: '#7dd3fc', shape: 'dowhile', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 80 },
    ],
  },
  {
    id: 'flowchart',
    name: 'Flow Chart',
    description: 'Visualize process logic with standard flowchart symbols',
    icon: 'Workflow',
    color: '#06b6d4',
    edgeTypes: FLOW_EDGES,
    nodeTypes: [
      { type: 'flow-start', label: 'Start/End', icon: 'Play', color: '#22c55e', shape: 'ellipse', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 100, defaultHeight: 50 },
      { type: 'flow-process', label: 'Process', icon: 'Square', color: '#93c5fd', shape: 'rect', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 60 },
      { type: 'flow-decision', label: 'Decision', icon: 'Diamond', color: '#fcd34d', shape: 'diamond', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 120, defaultHeight: 100 },
      { type: 'flow-io', label: 'Input/Output', icon: 'ArrowLeftRight', color: '#c4b5fd', shape: 'parallelogram', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 60 },
      { type: 'flow-document', label: 'Document', icon: 'FileText', color: '#f9a8d4', shape: 'print', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 60 },
      { type: 'flow-preparation', label: 'Preparation', icon: 'Settings', color: '#fcd34d', shape: 'hexagon', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 70 },
      { type: 'flow-print', label: 'Print', icon: 'Printer', color: '#f9a8d4', shape: 'print', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 60 },
      { type: 'flow-card', label: 'Card Input', icon: 'CreditCard', color: '#6ee7b7', shape: 'card', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 60 },
      { type: 'flow-manual-input', label: 'Manual Input', icon: 'Keyboard', color: '#93c5fd', shape: 'manual-input', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 70 },
      { type: 'flow-predefined', label: 'Predefined Process', icon: 'FunctionSquare', color: '#a5b4fc', shape: 'predefined-process', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 60 },
      { type: 'flow-onpage', label: 'On-Page Ref', icon: 'Hash', color: '#fcd34d', shape: 'on-page-ref', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 60, defaultHeight: 60 },
      { type: 'flow-offpage', label: 'Off-Page Ref', icon: 'CornerUpRight', color: '#fdba74', shape: 'off-page-ref', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 80, defaultHeight: 70 },
      { type: 'flow-display', label: 'Display', icon: 'Monitor', color: '#67e8f9', shape: 'display', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 60 },
      { type: 'flow-database', label: 'Database', icon: 'Database', color: '#a5b4fc', shape: 'database', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 70 },
    ],
  },
  {
    id: 'class',
    name: 'Class Diagram',
    description: 'Model object-oriented structures with classes, attributes, and relationships',
    icon: 'Boxes',
    color: '#8b5cf6',
    edgeTypes: CLASS_EDGES,
    nodeTypes: [
      { type: 'class-node', label: 'Class', icon: 'Box', color: '#c4b5fd', shape: 'class-box', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 200, defaultHeight: 160, editable: true },
      { type: 'class-object', label: 'Object', icon: 'Square', color: '#d8b4fe', shape: 'object-box', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 180, defaultHeight: 60 },
    ],
  },
  {
    id: 'sequence',
    name: 'Sequence Diagram',
    description: 'Show interactions between objects over time with lifelines and messages',
    icon: 'ArrowDownToLine',
    color: '#f59e0b',
    edgeTypes: SEQ_EDGES,
    nodeTypes: [
      { type: 'seq-actor', label: 'Actor', icon: 'User', color: '#3b82f6', shape: 'actor', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 80, defaultHeight: 100 },
      { type: 'seq-object', label: 'Object', icon: 'Square', color: '#8b5cf6', shape: 'lifeline', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 140, defaultHeight: 200 },
      { type: 'seq-activation', label: 'Activation Box', icon: 'RectangleVertical', color: '#fbbf24', shape: 'activation-box', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 16, defaultHeight: 80 },
    ],
  },
  {
    id: 'component',
    name: 'Component Diagram',
    description: 'Model system architecture with components and their dependencies',
    icon: 'Component',
    color: '#10b981',
    edgeTypes: COMPONENT_EDGES,
    nodeTypes: [
      { type: 'comp-component', label: 'Component', icon: 'Component', color: '#6ee7b7', shape: 'component', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 180, defaultHeight: 120, editable: true },
      { type: 'comp-component-noattr', label: 'Component (Annotation)', icon: 'Component', color: '#6ee7b7', shape: 'component', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 180, defaultHeight: 60, variant: 'no-attribute' },
      { type: 'comp-package', label: 'Package', icon: 'Package', color: '#93c5fd', shape: 'package', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 200, defaultHeight: 120 },
      { type: 'comp-note', label: 'Note', icon: 'StickyNote', color: '#fde047', shape: 'note', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 160, defaultHeight: 80 },
      { type: 'comp-provided', label: 'Provided Interface', icon: 'Circle', color: '#6366f1', shape: 'provided-interface', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 60, defaultHeight: 60 },
      { type: 'comp-required', label: 'Required Interface', icon: 'CircleDashed', color: '#6366f1', shape: 'required-interface', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 60, defaultHeight: 60 },
    ],
  },
  {
    id: 'ui',
    name: 'UI Design',
    description: 'Design user interface layouts with realistic UI components',
    icon: 'Monitor',
    color: '#ec4899',
    nodeTypes: [
      { type: 'ui-button', label: 'Button', icon: 'MousePointerClick', color: '#3b82f6', shape: 'ui-button', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 120, defaultHeight: 40 },
      { type: 'ui-input', label: 'Input Field', icon: 'TextCursorInput', color: '#8b5cf6', shape: 'ui-input', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 200, defaultHeight: 40 },
      { type: 'ui-label', label: 'Label', icon: 'Type', color: '#64748b', shape: 'ui-label', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 120, defaultHeight: 24 },
      { type: 'ui-image', label: 'Image', icon: 'Image', color: '#10b981', shape: 'ui-image', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 150, defaultHeight: 100 },
      { type: 'ui-container', label: 'Container', icon: 'LayoutPanelTop', color: '#f59e0b', shape: 'ui-container', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 280, defaultHeight: 180 },
      { type: 'ui-window', label: 'Window', icon: 'AppWindow', color: '#64748b', shape: 'ui-window', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 320, defaultHeight: 220 },
      { type: 'ui-modal', label: 'Confirm Modal', icon: 'MessageSquareWarning', color: '#ef4444', shape: 'ui-modal', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 280, defaultHeight: 160 },
      { type: 'ui-checkbox', label: 'Checkbox', icon: 'CheckSquare', color: '#3b82f6', shape: 'ui-checkbox', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 160, defaultHeight: 32 },
      { type: 'ui-combobox', label: 'Combo Box', icon: 'ChevronDownSquare', color: '#8b5cf6', shape: 'ui-combobox', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 180, defaultHeight: 36 },
      { type: 'ui-listbox', label: 'List Box', icon: 'List', color: '#06b6d4', shape: 'ui-listbox', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 160, defaultHeight: 120 },
      { type: 'ui-radio', label: 'Radio Button', icon: 'CircleDot', color: '#ec4899', shape: 'ui-radio', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 160, defaultHeight: 32 },
    ],
  },
  {
    id: 'er',
    name: 'ER Diagram',
    description: 'Design database schemas with entity tables and crow\u2019s foot relationships',
    icon: 'Database',
    color: '#f97316',
    edgeTypes: ER_EDGES,
    nodeTypes: [
      { type: 'er-entity', label: 'Entity (Table)', icon: 'Table', color: '#fdba74', shape: 'table', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 200, defaultHeight: 140, editable: true },
      { type: 'er-comment', label: 'Comment Link', icon: 'MessageCircle', color: '#64748b', shape: 'comment-link', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 120, defaultHeight: 60 },
    ],
  },
  {
    id: 'usecase',
    name: 'Use Case Diagram',
    description: 'Model system functionality with actors, use cases, and relationships',
    icon: 'Users',
    color: '#6366f1',
    edgeTypes: UC_EDGES,
    nodeTypes: [
      { type: 'uc-actor', label: 'Actor', icon: 'User', color: '#3b82f6', shape: 'actor', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 80, defaultHeight: 120 },
      { type: 'uc-usecase', label: 'Use Case', icon: 'Circle', color: '#a5b4fc', shape: 'ellipse', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 160, defaultHeight: 60 },
      { type: 'uc-system', label: 'System Boundary', icon: 'SquareDashed', color: '#64748b', shape: 'system-boundary', hasSourceHandle: false, hasTargetHandle: false, defaultWidth: 350, defaultHeight: 280 },
      { type: 'uc-package', label: 'Package', icon: 'Package', color: '#93c5fd', shape: 'package', hasSourceHandle: true, hasTargetHandle: true, defaultWidth: 200, defaultHeight: 120 },
    ],
  },
];
