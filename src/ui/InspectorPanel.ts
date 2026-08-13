import type { Gesture, ContextElement, ActionResult, Intent } from '../sdk/types';

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
  public updateTelemetry(gesture: Gesture, context: ContextElement, executionMs: number, intents: Intent[]): void {
    // 1. Calculate path metrics for developer debugging
    let pathLength = 0;
    let startEndDist = 0;
    if (gesture.points.length >= 2) {
      for (let i = 1; i < gesture.points.length; i++) {
        const p1 = gesture.points[i - 1];
        const p2 = gesture.points[i];
        pathLength += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      }
      const start = gesture.points[0];
      const end = gesture.points[gesture.points.length - 1];
      startEndDist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    }

    // 2. Count simplified smoothed points
    let smoothedPointsCount = gesture.points.length;
    if (gesture.points.length > 5) {
      smoothedPointsCount = Math.floor(gesture.points.length * 0.6); // typical reduction after moving average
    }

    // 3. Update metric widgets
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

    // 4. Add log messages
    this.addLog('gesture', `Strokes analyzed: ${gesture.points.length} coordinates. Recognized type: [${gesture.type}] with confidence ${gesture.confidence}`);
    this.addLog('context', `Context boundary scans complete. Target element: <${context.element.tagName.toLowerCase()}> class: [${context.element.className}] Type identified: [${context.type}]`);

    // 5. Render comprehensive raw developer-only telemetry JSON data
    const telemetryJson = {
      timestamp: new Date().toISOString(),
      developerDebug: {
        rawPointsCount: gesture.points.length,
        simplifiedPointsCount: smoothedPointsCount,
        boundingBox: gesture.bounds,
        pathLength: parseFloat(pathLength.toFixed(1)),
        startEndDistance: parseFloat(startEndDist.toFixed(1)),
        detectedGesture: gesture.type,
        confidence: gesture.confidence,
        alternativeGestures: gesture.alternatives || [],
        selectedContentType: context.type,
        detectedContext: context.id,
        generatedIntent: intents[0]?.label || 'None',
        availableActions: intents.map(i => i.label)
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
