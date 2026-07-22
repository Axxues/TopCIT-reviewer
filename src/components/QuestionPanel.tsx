import { useState } from 'react';
import { Lightbulb, ChevronDown, ChevronUp, CheckCircle2, XCircle, Award, RotateCcw, Eye } from 'lucide-react';
import type { Question } from '../data/diagramTypes';
import type { Node, Edge } from '@xyflow/react';

interface QuestionPanelProps {
  question: Question;
  nodes: Node[];
  edges: Edge[];
  onReset: () => void;
  onShowSolution: () => void;
}

interface ScoreResult {
  matchedNodes: number;
  totalExpectedNodes: number;
  matchedEdges: number;
  totalExpectedEdges: number;
  missingNodes: string[];
  missingEdges: string[];
  extraNodes: number;
  extraEdges: number;
  percentage: number;
}

function calculateScore(question: Question, nodes: Node[], edges: Edge[]): ScoreResult {
  const expectedNodeTypes = new Map<string, string>();
  question.nodes.forEach(n => {
    expectedNodeTypes.set(n.id, n.type);
  });

  const userNodeTypes = new Map<string, string>();
  nodes.forEach(n => {
    const data = n.data as { nodeType?: { type: string } };
    if (data?.nodeType?.type) {
      userNodeTypes.set(n.id, data.nodeType.type);
    }
  });

  const expectedTypeCounts = new Map<string, number>();
  question.nodes.forEach(n => {
    expectedTypeCounts.set(n.type, (expectedTypeCounts.get(n.type) || 0) + 1);
  });

  const userTypeCounts = new Map<string, number>();
  nodes.forEach(n => {
    const data = n.data as { nodeType?: { type: string } };
    if (data?.nodeType?.type) {
      userTypeCounts.set(data.nodeType.type, (userTypeCounts.get(data.nodeType.type) || 0) + 1);
    }
  });

  let matchedNodes = 0;
  const missingNodes: string[] = [];
  for (const [type, expectedCount] of expectedTypeCounts) {
    const userCount = userTypeCounts.get(type) || 0;
    const matched = Math.min(expectedCount, userCount);
    matchedNodes += matched;
    if (matched < expectedCount) {
      const missing = expectedCount - matched;
      const nodeDef = question.nodes.find(n => n.type === type);
      missingNodes.push(`${missing}x ${nodeDef?.label || type}`);
    }
  }

  const extraNodes = Math.max(0, nodes.length - question.nodes.length);

  const expectedNodeTypeMap = new Map<string, string>();
  question.nodes.forEach(n => {
    expectedNodeTypeMap.set(n.id, n.type);
  });

  const userNodeTypeMap = new Map<string, string>();
  nodes.forEach(n => {
    const data = n.data as { nodeType?: { type: string } };
    if (data?.nodeType?.type) {
      userNodeTypeMap.set(n.id, data.nodeType.type);
    }
  });

  const expectedEdgeTypeSet = new Set(question.edges.map(e =>
    `${expectedNodeTypeMap.get(e.source) || e.source}->${expectedNodeTypeMap.get(e.target) || e.target}`
  ));
  const userEdgeTypeSet = new Set(edges.map(e =>
    `${userNodeTypeMap.get(e.source) || e.source}->${userNodeTypeMap.get(e.target) || e.target}`
  ));

  let matchedEdges = 0;
  const missingEdges: string[] = [];
  expectedEdgeTypeSet.forEach(key => {
    if (userEdgeTypeSet.has(key)) {
      matchedEdges++;
    } else {
      const [srcType, tgtType] = key.split('->');
      const srcNode = question.nodes.find(n => n.type === srcType);
      const tgtNode = question.nodes.find(n => n.type === tgtType);
      missingEdges.push(`${srcNode?.label || srcType} -> ${tgtNode?.label || tgtType}`);
    }
  });

  const extraEdges = Math.max(0, edges.length - question.edges.length);

  const totalItems = question.nodes.length + question.edges.length;
  const matchedItems = matchedNodes + matchedEdges;
  const percentage = totalItems > 0 ? Math.round((matchedItems / totalItems) * 100) : 0;

  return {
    matchedNodes,
    totalExpectedNodes: question.nodes.length,
    matchedEdges,
    totalExpectedEdges: question.edges.length,
    missingNodes,
    missingEdges,
    extraNodes,
    extraEdges,
    percentage,
  };
}

export default function QuestionPanel({ question, nodes, edges, onReset, onShowSolution }: QuestionPanelProps) {
  const [showHints, setShowHints] = useState(false);
  const [scoreResult, setScoreResult] = useState<ScoreResult | null>(null);
  const [showSolution, setShowSolution] = useState(false);

  const handleCheck = () => {
    const result = calculateScore(question, nodes, edges);
    setScoreResult(result);
    setShowSolution(false);
  };

  const handleShowSolution = () => {
    onShowSolution();
    setShowSolution(true);
  };

  const difficultyColor = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-red-100 text-red-700',
  };

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColor[question.difficulty]}`}>
            {question.difficulty.toUpperCase()}
          </span>
        </div>
        <h3 className="text-base font-bold text-gray-800">{question.title}</h3>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-200">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Problem Statement</h4>
          <p className="text-sm text-gray-700 leading-relaxed">{question.description}</p>
        </div>

        <div className="px-4 py-3 border-b border-gray-200">
          <button
            onClick={() => setShowHints(!showHints)}
            className="flex items-center justify-between w-full text-sm font-semibold text-gray-700 hover:text-topcit-600"
          >
            <span className="flex items-center gap-2">
              <Lightbulb size={16} className="text-yellow-500" />
              Hints
            </span>
            {showHints ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {showHints && (
            <ul className="mt-2 space-y-1.5">
              {question.hints.map((hint, i) => (
                <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                  <span className="text-yellow-500 mt-0.5">•</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {scoreResult && (
          <div className="px-4 py-3 border-b border-gray-200">
            <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Score</h4>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="w-16 h-16 transform -rotate-90">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke={scoreResult.percentage >= 80 ? '#22c55e' : scoreResult.percentage >= 50 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="6"
                    strokeDasharray={`${(scoreResult.percentage / 100) * 175.93} 175.93`}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-sm font-bold text-gray-700">{scoreResult.percentage}%</span>
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 size={16} className="text-green-500" />
                  <span className="text-gray-700">Nodes: {scoreResult.matchedNodes}/{scoreResult.totalExpectedNodes}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 size={16} className="text-green-500" />
                  <span className="text-gray-700">Edges: {scoreResult.matchedEdges}/{scoreResult.totalExpectedEdges}</span>
                </div>
              </div>
            </div>

            {scoreResult.missingNodes.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-red-600 mb-1">Missing Nodes:</p>
                <ul className="space-y-0.5">
                  {scoreResult.missingNodes.map((n, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <XCircle size={12} className="text-red-400 mt-0.5" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {scoreResult.missingEdges.length > 0 && (
              <div className="mb-2">
                <p className="text-xs font-medium text-red-600 mb-1">Missing Connections:</p>
                <ul className="space-y-0.5">
                  {scoreResult.missingEdges.map((e, i) => (
                    <li key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
                      <XCircle size={12} className="text-red-400 mt-0.5" />
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {scoreResult.percentage === 100 && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg flex items-center gap-2">
                <Award size={20} className="text-green-600" />
                <span className="text-sm font-medium text-green-700">Perfect Score!</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 space-y-2">
        <button
          onClick={handleCheck}
          className="w-full py-2.5 bg-topcit-600 text-white text-sm font-medium rounded-lg hover:bg-topcit-700 transition-colors flex items-center justify-center gap-2"
        >
          <CheckCircle2 size={18} />
          Check Answer
        </button>
        {scoreResult && (
          <button
            onClick={handleShowSolution}
            className={`w-full py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${showSolution ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
          >
            <Eye size={18} />
            {showSolution ? 'Solution Shown' : 'Show Solution'}
          </button>
        )}
        <button
          onClick={() => { setScoreResult(null); setShowSolution(false); onReset(); }}
          className="w-full py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
        >
          <RotateCcw size={18} />
          Reset Canvas
        </button>
      </div>
    </div>
  );
}
