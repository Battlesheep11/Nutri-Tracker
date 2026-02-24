export class DebugLogger {
  constructor(sessionId = null) {
    this.sessionId = sessionId || `session-${Date.now()}`;
    this.entries = [];
    this.chainOfThought = [];
  }

  log(entry) {
    this.entries.push({
      timestamp: new Date().toISOString(),
      plan_step: entry.plan_step || 'unknown',
      action: entry.action || '',
      tool: entry.tool || 'none',
      input_summary: entry.input_summary || {},
      output_summary: entry.output_summary || {},
      status: entry.status || 'ok',
      rationale: entry.rationale || '',
    });
  }

  addThought(step, thought) {
    this.chainOfThought.push({
      timestamp: new Date().toISOString(),
      step,
      thought,
    });
  }

  getFullLog() {
    return {
      session_id: this.sessionId,
      entries: this.entries,
      chain_of_thought: this.chainOfThought,
    };
  }

}
