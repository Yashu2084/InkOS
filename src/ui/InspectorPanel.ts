import type { Gesture, ContextElement, ActionResult } from '../sdk/types';

export class InspectorPanel {
  private logListEl: HTMLUListElement;
  private ptsMetricEl: HTMLElement;
  private gestureMetricEl: HTMLElement;
  private contextMetricEl: HTMLElement;
  private speedMetricEl: HTMLElement;
  private rawInspectorEl: HTMLElement;

  constructor(selectors: {
    logList: string;
    ptsMetric: string;
    gestureMetric: string;
    contextMetric: string;
    speedMetric: string;
    rawInspector: string;
  }) {
    this.logListEl = document.querySelector(selectors.logList) as HTMLUListElement;
    this.ptsMetricEl = document.querySelector(selectors.ptsMetric) as HTMLElement;
    this.gestureMetricEl = document.querySelector(selectors.gestureMetric) as HTMLElement;
    this.contextMetricEl = document.querySelector(selectors.contextMetric) as HTMLElement;
    this.speedMetricEl = document.querySelector(selectors.speedMetric) as HTMLElement;
    this.rawInspectorEl = document.querySelector(selectors.rawInspector) as HTMLElement;
    
    this.addLog('system', 'InkOS SDK Initialized. Ready for drawing...');
  }

  /**
   * Appends a log line to the scrolling debugger console.
   */
  public addLog(category: 'system' | 'gesture' | 'context' | 'intent' | 'action', message: string): void {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    const li = document.createElement('li');
    li.className = `log-item ${category}`;
    li.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
    
    this.logListEl.appendChild(li);
    
    // Auto scroll to bottom
    this.logListEl.scrollTop = this.logListEl.scrollHeight;
  }

  /**
   * Resets raw inspector output.
   */
  public clearInspector(): void {
    this.rawInspectorEl.textContent = '// Ready. Draw on mock screen to start telemetry...';
  }

  /**
   * Updates metrics and raw values from active engine analysis.
   */
  public updateTelemetry(gesture: Gesture, context: ContextElement, executionMs: number): void {
    // 1. Update metric widgets
    this.ptsMetricEl.textContent = String(gesture.points.length);
    
    if (gesture.type === 'unknown') {
      this.gestureMetricEl.textContent = 'None';
      this.gestureMetricEl.style.color = '#6B7280';
    } else {
      this.gestureMetricEl.textContent = `${gesture.type} (${Math.round(gesture.confidence * 100)}%)`;
      this.gestureMetricEl.style.color = '#C084FC';
    }

    if (context.type === 'empty') {
      this.contextMetricEl.textContent = 'Empty screen';
      this.contextMetricEl.style.color = '#9CA3AF';
    } else {
      this.contextMetricEl.textContent = `${context.type.toUpperCase()}`;
      this.contextMetricEl.style.color = '#60A5FA';
    }

    this.speedMetricEl.textContent = `${executionMs.toFixed(1)}ms`;

    // 2. Add log messages
    this.addLog('gesture', `Strokes analyzed: ${gesture.points.length} coordinates. Recognized type: [${gesture.type}] with confidence ${gesture.confidence}`);
    this.addLog('context', `Context boundary scans complete. Target element: <${context.element.tagName.toLowerCase()}> class: [${context.element.className}] Type identified: [${context.type}]`);

    // 3. Render raw JSON data
    const telemetryJson = {
      timestamp: new Date().toISOString(),
      gesture: {
        type: gesture.type,
        confidence: gesture.confidence,
        boundingBox: gesture.bounds,
        pointsCount: gesture.points.length
      },
      context: {
        id: context.id,
        type: context.type,
        contentExcerpt: context.content.length > 50 ? context.content.substring(0, 47) + '...' : context.content,
        boundingBox: context.bounds,
        metadata: context.metadata || null
      }
    };

    this.rawInspectorEl.textContent = JSON.stringify(telemetryJson, null, 2);
  }

  /**
   * Logs actions execution results.
   */
  public updateActionTelemetry(intentId: string, result: ActionResult): void {
    if (result.success) {
      this.addLog('action', `Action [${intentId}] executed successfully.`);
      if (result.message) {
        this.addLog('action', `Result payload: ${result.message}`);
      }
    } else {
      this.addLog('system', `🚨 Action [${intentId}] execution failed: ${result.message || 'unknown error'}`);
    }
  }
}
