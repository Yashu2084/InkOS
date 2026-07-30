import type { Point, ActionResult } from './sdk/types';
import { GestureEngine } from './sdk/GestureEngine';
import { ContextEngine } from './sdk/ContextEngine';
import { IntentEngine } from './sdk/IntentEngine';
import { ActionEngine } from './sdk/ActionEngine';
import { PluginEngine } from './sdk/PluginEngine';

import { CanvasOverlay } from './ui/CanvasOverlay';
import { ActionMenu } from './ui/ActionMenu';
import { InspectorPanel } from './ui/InspectorPanel';

// Elements references
const deviceScreen = document.getElementById('device-screen') as HTMLElement;
const deviceContainer = document.getElementById('device-container') as HTMLElement;
const canvasElement = document.getElementById('ink-canvas') as HTMLCanvasElement;

// Instantiate sub-systems
const pluginEngine = new PluginEngine();
const actionMenu = new ActionMenu(deviceContainer);
const inspector = new InspectorPanel({
  logList: '#log-list',
  ptsMetric: '#metric-points',
  gestureMetric: '#metric-gesture',
  contextMetric: '#metric-context',
  speedMetric: '#metric-speed',
  rawInspector: '#raw-inspector',
});

// Initialize Canvas overlay drawing capture
new CanvasOverlay(canvasElement, handleGestureComplete);

// Handle gesture completion
async function handleGestureComplete(points: Point[]): Promise<void> {
  const startTime = performance.now();

  // 1. Run Gesture Engine (local heuristics)
  const gesture = GestureEngine.recognize(points);

  // 2. Run Context Engine (scan DOM elements in deviceScreen viewport)
  const context = ContextEngine.detectContext(gesture.bounds, deviceScreen);

  // 3. Run Intent Engine (map gesture + context + plugins -> intents)
  const intents = IntentEngine.predict(gesture, context, pluginEngine);

  const endTime = performance.now();
  const latency = endTime - startTime;

  // 4. Update debugging telemetry panel
  inspector.updateTelemetry(gesture, context, latency);

  // If gesture is totally unknown and no context was matched, clear and reset
  if (gesture.type === 'unknown' && context.type === 'empty') {
    inspector.addLog('system', 'No gesture shape or screen context recognized. Clearing canvas.');
    actionMenu.hide();
    actionMenu.hideResult();
    inspector.clearInspector();
    return;
  }

  // Calculate coordinates relative to the device-frame viewport
  // to position our absolute menus properly
  const deviceRect = deviceContainer.getBoundingClientRect();
  
  // Calculate gesture centroid relative to the device bezel
  const centroidX = gesture.points.reduce((sum, p) => sum + p.x, 0) / gesture.points.length;
  // Offset canvas top boundary offset (30px header bar)
  const centroidY = (gesture.points.reduce((sum, p) => sum + p.y, 0) / gesture.points.length) + 30;

  const menuPos = {
    x: centroidX,
    y: centroidY
  };

  // 5. Present matched actions menu
  actionMenu.show(intents, menuPos, async (selectedIntent) => {
    // Show loader state
    actionMenu.showLoading(menuPos);

    let result: ActionResult;

    try {
      // Check if it's a plugin action or standard system action
      if (selectedIntent.id.includes(':')) {
        inspector.addLog('action', `Delegating action request to plugin: [${selectedIntent.id}]`);
        result = await pluginEngine.executeIntent(selectedIntent.id, context, gesture);
      } else {
        inspector.addLog('action', `Executing core system action: [${selectedIntent.id}]`);
        result = await ActionEngine.execute(selectedIntent.id, context, gesture);
      }

      // Update log inspector
      inspector.updateActionTelemetry(selectedIntent.id, result);

      if (result.success && result.displayHtml) {
        // Find center of target element or gesture center to overlay results card
        const targetElement = context.element;
        const targetRect = targetElement.getBoundingClientRect();
        
        const resultPos = {
          x: targetRect.left - deviceRect.left + targetRect.width / 2,
          y: targetRect.top - deviceRect.top + targetRect.height + 10
        };

        // If context is empty, position near the gesture coordinates
        if (context.type === 'empty') {
          resultPos.x = menuPos.x;
          resultPos.y = menuPos.y;
        }

        actionMenu.showResult(result.displayHtml, resultPos, () => {
          // Callback when result card is closed
          inspector.clearInspector();
        });
      } else if (!result.success) {
        alert(`Failed to execute action: ${result.message}`);
        actionMenu.hide();
      } else {
        // Standard copy/silent actions with success log only
        actionMenu.hide();
        inspector.clearInspector();
      }
    } catch (e: any) {
      inspector.addLog('system', `🚨 SDK Engine Error: ${e.message || e}`);
      actionMenu.hide();
    }
  });
}
