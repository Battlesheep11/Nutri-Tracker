'use client';

import { useState } from 'react';
import { X, Bug, ChevronDown, ChevronRight, Brain, Wrench, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

function StatusIcon({ status }) {
  switch (status) {
    case 'ok':
      return <CheckCircle className="w-3.5 h-3.5 text-green-500" />;
    case 'error':
      return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    case 'retry':
      return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
    default:
      return <CheckCircle className="w-3.5 h-3.5 text-gray-400" />;
  }
}

function LogEntry({ entry, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-secondary/50 transition-colors cursor-pointer"
      >
        {expanded ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
        <span className="text-xs text-muted-foreground w-6">{index + 1}</span>
        <StatusIcon status={entry.status} />
        <span className="text-xs font-medium flex-1 truncate">{entry.plan_step}</span>
        <span className="text-xs text-muted-foreground">{entry.tool !== 'none' ? entry.tool : ''}</span>
        <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString()}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 border-t border-border bg-secondary/20">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2 text-xs">
            <div>
              <span className="font-semibold text-muted-foreground">Action:</span>
              <span className="ml-1">{entry.action}</span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground">Tool:</span>
              <span className="ml-1">{entry.tool}</span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground">Status:</span>
              <span className={`ml-1 font-medium ${
                entry.status === 'ok' ? 'text-green-600' : entry.status === 'error' ? 'text-red-600' : 'text-amber-600'
              }`}>{entry.status}</span>
            </div>
            <div>
              <span className="font-semibold text-muted-foreground">Time:</span>
              <span className="ml-1">{entry.timestamp}</span>
            </div>
          </div>
          <div className="mt-2">
            <span className="text-xs font-semibold text-muted-foreground">Input:</span>
            <pre className="mt-1 p-2 bg-card rounded text-xs overflow-x-auto border border-border">
              {JSON.stringify(entry.input_summary, null, 2)}
            </pre>
          </div>
          <div className="mt-2">
            <span className="text-xs font-semibold text-muted-foreground">Output:</span>
            <pre className="mt-1 p-2 bg-card rounded text-xs overflow-x-auto border border-border">
              {JSON.stringify(entry.output_summary, null, 2)}
            </pre>
          </div>
          {entry.rationale && (
            <div className="mt-2">
              <span className="text-xs font-semibold text-muted-foreground">Rationale:</span>
              <p className="mt-0.5 text-xs text-foreground">{entry.rationale}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThoughtEntry({ thought, index }) {
  return (
    <div className="flex gap-3 px-3 py-2 border border-border rounded-lg bg-purple-50/50">
      <Brain className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold text-purple-700">{thought.step}</span>
          <span className="text-xs text-muted-foreground">{new Date(thought.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="text-xs text-foreground whitespace-pre-wrap">{thought.thought}</p>
      </div>
    </div>
  );
}

export default function DebugLogViewer({ isOpen, onClose, debugLog }) {
  const [activeTab, setActiveTab] = useState('thoughts');

  if (!isOpen) return null;

  const entries = debugLog?.entries || [];
  const thoughts = debugLog?.chain_of_thought || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden mx-4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Debug Log</h2>
            <span className="text-xs text-muted-foreground">
              Session: {debugLog?.session_id?.slice(0, 16) || 'N/A'}
            </span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded-lg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6">
          <button
            onClick={() => setActiveTab('thoughts')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'thoughts'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Brain className="w-3.5 h-3.5" />
              Chain of Thought ({thoughts.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('trace')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === 'trace'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              Tool Trace ({entries.length})
            </span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {activeTab === 'thoughts' && (
            <>
              {thoughts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No chain-of-thought data yet. Send a message to the agent.
                </p>
              ) : (
                thoughts.map((thought, i) => (
                  <ThoughtEntry key={i} thought={thought} index={i} />
                ))
              )}
            </>
          )}

          {activeTab === 'trace' && (
            <>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No trace entries yet. Send a message to the agent.
                </p>
              ) : (
                entries.map((entry, i) => (
                  <LogEntry key={i} entry={entry} index={i} />
                ))
              )}
            </>
          )}
        </div>

        {/* Footer with raw JSON toggle */}
        <div className="px-6 py-3 border-t border-border flex justify-between items-center">
          <span className="text-xs text-muted-foreground">
            {entries.filter(e => e.status === 'error').length} error(s) &middot;{' '}
            {entries.filter(e => e.status === 'ok').length} ok
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(debugLog, null, 2));
            }}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            Copy full log as JSON
          </button>
        </div>
      </div>
    </div>
  );
}
