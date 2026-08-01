import type { Point, ActionResult, Intent } from './sdk/types';
import { GestureEngine } from './sdk/GestureEngine';
import { ContextEngine } from './sdk/ContextEngine';
import { IntentEngine } from './sdk/IntentEngine';
import { ActionEngine } from './sdk/ActionEngine';
import { PluginEngine } from './sdk/PluginEngine';
import { AudioSynth } from './sdk/AudioSynth';

import { CanvasOverlay } from './ui/CanvasOverlay';
import { ActionMenu } from './ui/ActionMenu';
import { InspectorPanel } from './ui/InspectorPanel';
import { ControlCenter } from './ui/ControlCenter';

// Elements references
const deviceScreen = document.getElementById('device-screen') as HTMLElement;
const deviceContainer = document.getElementById('device-container') as HTMLElement;
const canvasElement = document.getElementById('ink-canvas') as HTMLCanvasElement;
const dimmedOverlay = document.getElementById('dimmed-overlay') as HTMLElement;

// Sound & Audio permission unlocking
let audioUnlocked = false;
function unlockAudioContext() {
  if (audioUnlocked) return;
  // Execute a dummy sound click to trigger browser authorization
  AudioSynth.playClick();
  audioUnlocked = true;
  document.removeEventListener('click', unlockAudioContext);
  document.removeEventListener('keydown', unlockAudioContext);
}
document.addEventListener('click', unlockAudioContext);
document.addEventListener('keydown', unlockAudioContext);

// Instantiate Sub-Systems
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

// Canvas & drawing layer overlay
const canvasOverlay = new CanvasOverlay(canvasElement, handleGestureComplete);

// Core Overlay Toggle Logic (Ctrl + Space / Orb trigger)
let isOverlayActive = false;

function toggleInkOverlay(active?: boolean): void {
  const nextState = active !== undefined ? active : !isOverlayActive;
  if (nextState === isOverlayActive) return;
  isOverlayActive = nextState;

  if (isOverlayActive) {
    // Dim the screen and blur
    dimmedOverlay.classList.add('dimmed');
    canvasElement.style.pointerEvents = 'auto';
    canvasElement.style.opacity = '1';
    
    // Play warm ripple sound on overlay activation
    AudioSynth.playRipple();
    inspector.addLog('system', 'InkOS Intent overlay activated. Cursor locked into digital glass canvas.');
  } else {
    // Reset overlay
    dimmedOverlay.classList.remove('dimmed');
    canvasElement.style.pointerEvents = 'none';
    
    // Clear drawings, menus, and cursors
    canvasOverlay.clearCanvas();
    actionMenu.hide();
    actionMenu.hideResult();
    
    const cursor = document.getElementById('ink-pointer');
    if (cursor) cursor.style.display = 'none';
    
    // Play click sound on deactivate
    AudioSynth.playClick();
    inspector.addLog('system', 'Overlay deactivated. Returning focus to operating system.');
  }
}

// Bind Global Shortcut (Ctrl + Space)
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.code === 'Space') {
    e.preventDefault();
    toggleInkOverlay();
  }
});

// Floating Control Center Orb binding
const orbEl = document.getElementById('control-orb') as HTMLElement;
const panelEl = document.getElementById('control-panel') as HTMLElement;

new ControlCenter(orbEl, panelEl, (actionId) => {
  // Callback when a row inside the Control Center is selected
  switch (actionId) {
    case 'trigger_overlay':
      toggleInkOverlay(true);
      break;
    
    case 'open_settings':
      switchTab('tab-dashboard');
      break;
      
    case 'play_demo_sound':
      AudioSynth.playRipple();
      setTimeout(() => AudioSynth.playPop(), 400);
      setTimeout(() => AudioSynth.playClick(), 700);
      break;
      
    case 'clear_canvas':
      canvasOverlay.clearCanvas();
      actionMenu.hide();
      actionMenu.hideResult();
      inspector.clearInspector();
      break;
  }
});

// Master Header Navigation Tabs
const tabButtons = document.querySelectorAll('.nav-tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(targetTabId: string): void {
  // Switch header tab button styles
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab-id') === targetTabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Switch tab pages views
  tabContents.forEach(content => {
    if (content.id === targetTabId) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Scroll to top of window
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    AudioSynth.playPop();
    const tabId = btn.getAttribute('data-tab-id') || 'tab-home';
    switchTab(tabId);
  });
});

// Dashboard Settings Tabs Layout
const dashNavButtons = document.querySelectorAll('.dash-nav-btn');
const settingsGroups = document.querySelectorAll('.settings-viewport .settings-group');

dashNavButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    AudioSynth.playPop();
    
    dashNavButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    const subTab = btn.getAttribute('data-sub-tab') || 'general';
    
    settingsGroups.forEach(group => {
      if (group.id === `sub-tab-${subTab}`) {
        (group as HTMLElement).style.display = 'flex';
      } else {
        (group as HTMLElement).style.display = 'none';
      }
    });
  });
});

// Synchronize sound preferences toggle
const soundSwitch = document.getElementById('sound-switch') as HTMLInputElement;
if (soundSwitch) {
  soundSwitch.addEventListener('change', () => {
    AudioSynth.setEnabled(soundSwitch.checked);
    if (soundSwitch.checked) {
      AudioSynth.playPop();
    }
  });
}

// Wire Hero landing CTA buttons
const heroGetStarted = document.getElementById('hero-get-started') as HTMLElement;
if (heroGetStarted) {
  heroGetStarted.addEventListener('click', () => {
    AudioSynth.playPop();
    const simSection = document.getElementById('simulator-section');
    if (simSection) {
      simSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

const heroWatchDemo = document.getElementById('hero-watch-demo') as HTMLElement;
if (heroWatchDemo) {
  heroWatchDemo.addEventListener('click', () => {
    AudioSynth.playRipple();
    setTimeout(() => AudioSynth.playPop(), 300);
    setTimeout(() => AudioSynth.playClick(), 600);
  });
}

// Custom select bindings to trigger sound
const selects = document.querySelectorAll('.select-input');
selects.forEach(sel => {
  sel.addEventListener('change', () => {
    AudioSynth.playPop();
  });
});

// Core Gesture Drawing complete callback
async function handleGestureComplete(points: Point[]): Promise<void> {
  const startTime = performance.now();

  // 1. Gesture recognition heuristics
  const gesture = GestureEngine.recognize(points);

  // 2. Context element boundaries scan
  const context = ContextEngine.detectContext(gesture.bounds, deviceScreen);

  // 3. Intent mapping weighting
  const intents = IntentEngine.predict(gesture, context, pluginEngine);

  const endTime = performance.now();
  const latency = endTime - startTime;

  // 4. Update left inspector panel metrics and logger
  inspector.updateTelemetry(gesture, context, latency);

  // If drawing is empty/unknown, clear and exit
  if (gesture.type === 'unknown' && context.type === 'empty') {
    inspector.addLog('system', 'Drawing unrecognized. Clearing canvas overlay.');
    actionMenu.hide();
    actionMenu.hideResult();
    inspector.clearInspector();
    return;
  }

  // Position relative to the tablet bezel frame
  const deviceRect = deviceContainer.getBoundingClientRect();
  
  // Calculate gesture centroid inside canvas coordinate system
  const centroidX = gesture.points.reduce((sum, p) => sum + p.x, 0) / gesture.points.length;
  // Offset top bar (35px)
  const centroidY = (gesture.points.reduce((sum, p) => sum + p.y, 0) / gesture.points.length) + 35;

  const menuPos = {
    x: centroidX,
    y: centroidY
  };

  // Check config default execution mode
  const modeSelect = document.getElementById('mode-select') as HTMLSelectElement;
  const isAutoMode = modeSelect && modeSelect.value === 'auto';

  // 5. Execute action or show menu
  const executeIntent = async (selectedIntent: Intent) => {
    actionMenu.showLoading(menuPos);

    let result: ActionResult;
    try {
      if (selectedIntent.id.includes(':')) {
        inspector.addLog('action', `Delegating action request to plugin: [${selectedIntent.id}]`);
        result = await pluginEngine.executeIntent(selectedIntent.id, context, gesture);
      } else {
        inspector.addLog('action', `Executing core system action: [${selectedIntent.id}]`);
        result = await ActionEngine.execute(selectedIntent.id, context, gesture);
      }

      inspector.updateActionTelemetry(selectedIntent.id, result);

      if (result.success && result.displayHtml) {
        // Play action success pop sound
        AudioSynth.playClick();

        const targetElement = context.element;
        const targetRect = targetElement.getBoundingClientRect();
        
        // Calculate centered position next to the target element bounds
        const resultPos = {
          x: targetRect.left - deviceRect.left + targetRect.width / 2,
          y: targetRect.top - deviceRect.top + targetRect.height + 12
        };

        if (context.type === 'empty') {
          resultPos.x = menuPos.x;
          resultPos.y = menuPos.y;
        }

        actionMenu.showResult(result.displayHtml, resultPos, () => {
          inspector.clearInspector();
        });
      } else if (!result.success) {
        AudioSynth.playTone(); // Play warning audio tone
        alert(`Failed to execute action: ${result.message}`);
        actionMenu.hide();
      } else {
        // Copied text / silent actions
        AudioSynth.playClick();
        actionMenu.hide();
        inspector.clearInspector();
      }
    } catch (e: any) {
      AudioSynth.playTone();
      inspector.addLog('system', `🚨 SDK Engine Error: ${e.message || e}`);
      actionMenu.hide();
    }
  };

  if (isAutoMode && intents.length > 0) {
    // In immediate execution mode, bypass the menu and execute top intent automatically
    inspector.addLog('system', `Default execution mode set to IMMEDIATE. Auto-triggering: ${intents[0].label}`);
    await executeIntent(intents[0]);
  } else {
    // Show Vision Pro pill selection menu
    actionMenu.show(intents, menuPos, async (intent) => {
      await executeIntent(intent);
    });
  }
}
