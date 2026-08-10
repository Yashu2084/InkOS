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
import { GestureComposer } from './ui/GestureComposer';


// Elements references
const deviceContainer = (document.getElementById('device-container') || document.body) as HTMLElement;
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

let controlCenter: ControlCenter;

// Core Overlay Toggle Logic (Ctrl + Space / Orb trigger)
let isOverlayActive = false;

// Dynamic context highlights
let activeHighlightEl: HTMLElement | null = null;

function showElementHighlight(targetEl: HTMLElement) {
  removeElementHighlight();

  const rect = targetEl.getBoundingClientRect();
  const highlight = document.createElement('div');
  highlight.id = 'inkos-active-highlight';
  highlight.style.position = 'fixed';
  highlight.style.left = `${rect.left - 4}px`;
  highlight.style.top = `${rect.top - 4}px`;
  highlight.style.width = `${rect.width + 8}px`;
  highlight.style.height = `${rect.height + 8}px`;
  highlight.style.border = '2.5px solid var(--color-cyan)';
  highlight.style.borderRadius = '12px';
  highlight.style.boxShadow = '0 0 20px var(--color-cyan-glow), inset 0 0 10px var(--color-cyan-glow)';
  highlight.style.pointerEvents = 'none';
  highlight.style.zIndex = '99990';
  highlight.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
  highlight.style.animation = 'highlightGlow 1.5s infinite alternate ease-in-out';

  document.body.appendChild(highlight);
  activeHighlightEl = highlight;
}

function removeElementHighlight() {
  if (activeHighlightEl) {
    activeHighlightEl.remove();
    activeHighlightEl = null;
  }
}

type InkOSState = 
  | 'IDLE'
  | 'ACTIVATING'
  | 'DRAWING'
  | 'PROCESSING_SELECTION'
  | 'ACTION_MENU'
  | 'EXECUTING_ACTION'
  | 'SHOWING_RESULT';

let currentState: InkOSState = 'IDLE';

function transitionToState(nextState: InkOSState): void {
  const prevState = currentState;
  currentState = nextState;
  
  inspector.addLog('system', `State transition: ${prevState} ➔ ${nextState}`);

  const cursor = document.getElementById('ink-pointer');

  switch (nextState) {
    case 'IDLE':
      isOverlayActive = false;
      dimmedOverlay.classList.remove('dimmed');
      dimmedOverlay.style.pointerEvents = 'none';
      canvasElement.style.pointerEvents = 'none';
      canvasElement.style.opacity = '0';
      
      canvasOverlay.clearCanvas();
      actionMenu.hide();
      removeElementHighlight();
      
      if (cursor) cursor.style.display = 'none';
      if (controlCenter) controlCenter.setOrbState('idle');
      break;

    case 'ACTIVATING':
      isOverlayActive = true;
      dimmedOverlay.classList.add('dimmed');
      dimmedOverlay.style.pointerEvents = 'auto';
      canvasElement.style.pointerEvents = 'auto';
      canvasElement.style.opacity = '1';
      
      actionMenu.hideResult();
      actionMenu.hide();
      removeElementHighlight();
      
      if (cursor) {
        cursor.style.display = 'block';
      }
      if (controlCenter) controlCenter.setOrbState('listening');
      break;

    case 'DRAWING':
      isOverlayActive = true;
      dimmedOverlay.classList.add('dimmed');
      dimmedOverlay.style.pointerEvents = 'auto';
      canvasElement.style.pointerEvents = 'auto';
      canvasElement.style.opacity = '1';
      if (cursor) cursor.style.display = 'block';
      if (controlCenter) controlCenter.setOrbState('listening');
      break;

    case 'PROCESSING_SELECTION':
      dimmedOverlay.style.pointerEvents = 'none';
      canvasElement.style.pointerEvents = 'none';
      if (cursor) cursor.style.display = 'none';
      if (controlCenter) controlCenter.setOrbState('thinking');
      break;

    case 'ACTION_MENU':
      dimmedOverlay.style.pointerEvents = 'none';
      canvasElement.style.pointerEvents = 'none';
      if (cursor) cursor.style.display = 'none';
      if (controlCenter) controlCenter.setOrbState('listening');
      break;

    case 'EXECUTING_ACTION':
      dimmedOverlay.style.pointerEvents = 'none';
      canvasElement.style.pointerEvents = 'none';
      if (cursor) cursor.style.display = 'none';
      if (controlCenter) controlCenter.setOrbState('executing');
      break;

    case 'SHOWING_RESULT':
      isOverlayActive = false;
      dimmedOverlay.classList.remove('dimmed');
      dimmedOverlay.style.pointerEvents = 'none';
      canvasElement.style.pointerEvents = 'none';
      if (cursor) cursor.style.display = 'none';
      break;
  }
}

function toggleInkOverlay(active?: boolean): void {
  const nextActive = active !== undefined ? active : (currentState === 'IDLE');
  if (nextActive) {
    if (currentState === 'IDLE') {
      AudioSynth.playRipple();
      transitionToState('ACTIVATING');
    }
  } else {
    if (currentState !== 'IDLE') {
      AudioSynth.playClick();
      transitionToState('IDLE');
    }
  }
}

// Transition from ACTIVATING to DRAWING on canvas interaction
canvasElement.addEventListener('pointerdown', () => {
  if (currentState === 'ACTIVATING') {
    transitionToState('DRAWING');
  }
});

// Click outside listener (Intercepts cancels in capture phase)
window.addEventListener('pointerdown', (e) => {
  const target = e.target as HTMLElement;
  
  if (currentState === 'ACTION_MENU') {
    const menuEl = document.querySelector('.vision-action-pill');
    const clickedOrb = orbEl && orbEl.contains(target);
    if (menuEl && !menuEl.contains(target) && !clickedOrb) {
      e.stopPropagation();
      e.preventDefault();
      AudioSynth.playClick();
      transitionToState('IDLE');
    }
  } else if (currentState === 'SHOWING_RESULT') {
    const resultEl = document.querySelector('.glass-result-overlay');
    const clickedOrb = orbEl && orbEl.contains(target);
    if (resultEl && !resultEl.contains(target) && !clickedOrb) {
      e.stopPropagation();
      e.preventDefault();
      AudioSynth.playClick();
      transitionToState('IDLE');
    }
  }
}, true);

// Bind Escape key cancellation
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (currentState !== 'IDLE') {
      e.preventDefault();
      e.stopPropagation();
      AudioSynth.playClick();
      transitionToState('IDLE');
    }
  }
});

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

controlCenter = new ControlCenter(orbEl, panelEl, (actionId) => {
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

const heroTryInkos = document.getElementById('hero-try-inkos') as HTMLElement;
if (heroTryInkos) {
  heroTryInkos.addEventListener('click', (e) => {
    e.stopPropagation();
    AudioSynth.playPop();
    toggleInkOverlay(true);
    inspector.addLog('system', 'Demo mode activated. User can now draw around targets inside the workspace.');
  });
}

// Listen for keyboard cancel triggers from floating menus
window.addEventListener('inkos-cancel', () => {
  toggleInkOverlay(false);
});

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
  const context = ContextEngine.detectContext(gesture.bounds, document.body);

  // 3. Intent mapping weighting
  const intents = IntentEngine.predict(gesture, context, pluginEngine);

  const endTime = performance.now();
  const latency = endTime - startTime;

  // 4. Update left inspector panel metrics and logger
  inspector.updateTelemetry(gesture, context, latency);

  // If drawing is empty/unknown, clear and exit
  if (gesture.type === 'unknown' && context.type === 'empty') {
    inspector.addLog('system', 'Drawing unrecognized. Clearing canvas overlay.');
    transitionToState('IDLE');
    return;
  }

  // Highlight the matched element immediately
  if (context.type !== 'empty' && context.element) {
    showElementHighlight(context.element);
  }

  // Calculate gesture centroid (viewport relative coordinates)
  const centroidX = gesture.points.reduce((sum, p) => sum + p.x, 0) / gesture.points.length;
  const centroidY = gesture.points.reduce((sum, p) => sum + p.y, 0) / gesture.points.length;

  // Determine Action Pill placement coordinates
  let pillX = centroidX;
  let pillY = centroidY;
  let targetBoundsPage: { x: number; y: number; width: number; height: number } | undefined = undefined;

  if (context.type !== 'empty' && context.element) {
    const targetRect = context.element.getBoundingClientRect();
    targetBoundsPage = {
      x: targetRect.left + window.scrollX,
      y: targetRect.top + window.scrollY,
      width: targetRect.width,
      height: targetRect.height
    };

    // Calculate pill position (viewport relative)
    let left = targetRect.left + targetRect.width + 12;
    let top = targetRect.top;
    const elWidth = 250;
    const elHeight = 180;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    if (left + elWidth > screenWidth) {
      left = targetRect.left - elWidth - 12;
    }
    if (left < 0) {
      left = targetRect.left + (targetRect.width - elWidth) / 2;
      top = targetRect.top + targetRect.height + 12;
    }
    if (top + elHeight > screenHeight) {
      top = targetRect.top - elHeight - 12;
    }

    pillX = Math.max(12, Math.min(screenWidth - elWidth - 12, left));
    pillY = Math.max(12, Math.min(screenHeight - elHeight - 12, top));
  }

  // 5. Execute action routine
  const executeIntent = async (selectedIntent: Intent, executePosPage: { x: number; y: number }) => {
    transitionToState('EXECUTING_ACTION');
    
    // Sequential progress status steps
    await actionMenu.showLoading(executePosPage, [
      'Understanding Context...',
      'Recognizing Gesture...',
      'Analyzing Content...',
      'Executing Action...'
    ]);

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

      if (result.success) {
        logActivityEntry(gesture.type, context.type, selectedIntent.label, points, true);
        if (controlCenter) {
          controlCenter.setOrbState('completed');
          setTimeout(() => controlCenter.setOrbState('idle'), 1000);
        }
      } else {
        logActivityEntry(gesture.type, context.type, selectedIntent.label, points, false);
        if (controlCenter) {
          controlCenter.setOrbState('idle');
        }
      }

      if (result.success && result.displayHtml) {
        // Play action success pop sound
        AudioSynth.playClick();

        const targetElement = context.element;
        let resultPosPage = { ...executePosPage };
        
        if (context.type !== 'empty' && targetElement) {
          const targetRect = targetElement.getBoundingClientRect();
          resultPosPage = {
            x: targetRect.left + window.scrollX + targetRect.width / 2,
            y: targetRect.top + window.scrollY + targetRect.height + 12
          };
        }

        transitionToState('SHOWING_RESULT');
        actionMenu.showResult(result.displayHtml, resultPosPage, () => {
          transitionToState('IDLE');
        });
      } else {
        if (!result.success) {
          AudioSynth.playTone(); // Play warning audio tone
          alert(`Failed to execute action: ${result.message}`);
        } else {
          // Copied text / silent actions
          AudioSynth.playClick();
        }
        transitionToState('IDLE');
      }
    } catch (e: any) {
      AudioSynth.playTone();
      logActivityEntry(gesture.type, context.type, selectedIntent.label, points, false);
      inspector.addLog('system', `🚨 SDK Engine Error: ${e.message || e}`);
      transitionToState('IDLE');
    }
  };

  // Trigger coordinate morphing towards the Action Pill center coordinates
  transitionToState('PROCESSING_SELECTION');
  canvasOverlay.animateMorph(pillX, pillY, async () => {
    // Check config default execution mode
    const modeSelect = document.getElementById('mode-select') as HTMLSelectElement;
    const isAutoMode = modeSelect && modeSelect.value === 'auto';

    // Page relative coordinate where the pill menu appears
    const pillPosPage = {
      x: pillX + window.scrollX,
      y: pillY + window.scrollY
    };

    if (isAutoMode && intents.length > 0) {
      // In immediate execution mode, bypass the menu and execute top intent automatically
      inspector.addLog('system', `Default execution mode set to IMMEDIATE. Auto-triggering: ${intents[0].label}`);
      await executeIntent(intents[0], pillPosPage);
    } else {
      // Show Vision Pro pill selection menu
      transitionToState('ACTION_MENU');
      actionMenu.show(intents, pillPosPage, async (intent) => {
        await executeIntent(intent, pillPosPage);
      }, targetBoundsPage);
    }
  });
}

// --- MASTER OS UI/UX ENHANCEMENTS ENGINE CORES ---

// 1. Log recent activity telemetry locally
function logActivityEntry(shape: string, contextType: string, actionLabel: string, points: Point[], success: boolean) {
  try {
    const storedLogs = localStorage.getItem('inkos_activity_logs');
    const logs = storedLogs ? JSON.parse(storedLogs) : [];
    
    const newEntry = {
      id: 'act-' + Math.random().toString(36).substring(2, 9),
      shape,
      contextType,
      actionLabel,
      timestamp: new Date().toLocaleTimeString(),
      status: success ? 'success' : 'failed',
      points
    };
    
    logs.unshift(newEntry);
    if (logs.length > 10) logs.length = 10; // Cap at 10 items
    
    localStorage.setItem('inkos_activity_logs', JSON.stringify(logs));
    updateActivityHistoryUI();
  } catch (e) {
    console.error('Failed to log activity entry', e);
  }
}

// 2. Render and wire telemetry activity list items
function updateActivityHistoryUI() {
  const container = document.getElementById('activity-history-list');
  if (!container) return;

  try {
    const storedLogs = localStorage.getItem('inkos_activity_logs');
    const logs = storedLogs ? JSON.parse(storedLogs) : [];

    if (logs.length === 0) {
      container.innerHTML = `
        <li class="activity-item" style="color: var(--text-secondary); text-align: center; padding: 12px; font-style: italic;">
          No recent actions. Draw gestures on screen.
        </li>
      `;
      return;
    }

    container.innerHTML = logs.map((log: any) => `
      <li class="activity-item" data-id="${log.id}">
        <div class="activity-meta">
          <span>${log.timestamp}</span>
          <span style="color: ${log.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)'}; font-weight: 600;">
            ${log.status.toUpperCase()}
          </span>
        </div>
        <div style="font-weight: 500; font-size: 0.8rem; margin: 2px 0;">
          Shape: <strong style="color: var(--color-cyan); text-transform: capitalize;">${log.shape}</strong>
        </div>
        <div style="color: var(--text-secondary); font-size: 0.72rem; display: flex; align-items: baseline; justify-content: space-between;">
          <span>Context: ${log.contextType} | Action: ${log.actionLabel}</span>
          <a class="activity-replay-link" data-id="${log.id}">Replay 🎥</a>
        </div>
      </li>
    `).join('');

    // Wire replay button clicks
    container.querySelectorAll('.activity-replay-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.stopPropagation();
        const logId = link.getAttribute('data-id');
        const match = logs.find((l: any) => l.id === logId);
        if (match) {
          replayStroke(match.points, match.actionLabel);
        }
      });
    });
  } catch (e) {
    console.error('Error rendering activity logs', e);
  }
}

// 3. Replay Coordinate Stroke Points sequentially
let isReplaying = false;
async function replayStroke(points: Point[], actionLabel: string) {
  if (isReplaying) return;
  isReplaying = true;

  // Move views to Home Screen Tab
  switchTab('tab-home');
  
  // Clear layouts overlays and dim screen background
  toggleInkOverlay(true);
  canvasOverlay.clearCanvas();
  actionMenu.hide();
  actionMenu.hideResult();

  inspector.addLog('system', `🎥 Replaying captured gesture stroke for: [${actionLabel}]`);
  
  const drawDelay = 14;
  const strokeProgress: Point[] = [];
  const pointer = document.getElementById('ink-pointer');

  for (let i = 0; i < points.length; i++) {
    if (!isOverlayActive) break; // Interrupted
    
    strokeProgress.push(points[i]);
    canvasOverlay.drawPoints(strokeProgress);

    // Track visual cursor pointer
    if (pointer) {
      const rect = canvasElement.getBoundingClientRect();
      pointer.style.display = 'block';
      pointer.style.left = `${rect.left + points[i].x}px`;
      pointer.style.top = `${rect.top + points[i].y}px`;
    }

    await new Promise(resolve => setTimeout(resolve, drawDelay));
  }

  if (isOverlayActive) {
    AudioSynth.playClick();
    if (pointer) pointer.style.display = 'none';
    
    // Trigger compilation handlers
    await handleGestureComplete(points);
  }

  isReplaying = false;
}

// 4. settingsSearchFilter parameters Search Box
function initSettingsSearch() {
  const searchBar = document.getElementById('settings-search-bar') as HTMLInputElement;
  if (!searchBar) return;

  searchBar.addEventListener('input', () => {
    const query = searchBar.value.trim().toLowerCase();
    const rows = document.querySelectorAll('.settings-viewport .settings-row-inline, .settings-viewport .checkbox-row-card');

    rows.forEach(r => {
      const label = r.querySelector('label, strong')?.textContent || '';
      const desc = r.querySelector('.settings-desc, .btn-desc')?.textContent || '';
      const textToSearch = `${label} ${desc}`.toLowerCase();

      if (textToSearch.includes(query)) {
        (r as HTMLElement).style.display = 'flex';
      } else {
        (r as HTMLElement).style.display = 'none';
      }
    });
  });
}

// 5. Render Interactive Gesture Library cards & canvas preview loops
let libraryAnimIntervals: number[] = [];
function renderGestureLibrary() {
  const grid = document.getElementById('gesture-library-grid');
  if (!grid) return;

  // Clear existing intervals
  libraryAnimIntervals.forEach(clearInterval);
  libraryAnimIntervals = [];

  const standardShapes: { name: string; desc: string; pts: { x: number; y: number }[]; isCustom?: boolean }[] = [
    { name: 'circle', desc: 'Circles target items for visual calculations and detail explainers.', pts: generateCirclePoints() },
    { name: 'underline', desc: 'Underlining text blocks triggers language translation lookups.', pts: generateUnderlinePoints() },
    { name: 'arrow', desc: 'Points elements out to overlay contextual configuration menus.', pts: generateArrowPoints() },
    { name: 'lasso', desc: 'Irregular lasso loops select elements like grid tabular layouts.', pts: generateLassoPoints() },
    { name: 'rectangle', desc: 'Envelopes code blocks and paragraph grids.', pts: generateRectPoints() },
    { name: 'cross', desc: 'Cross marks clear overlays and dismiss notifications.', pts: generateCrossPoints() },
    { name: 'question', desc: 'Sums up text summaries and detailed concept explanations.', pts: generateQuestionPoints() },
    { name: 'tick', desc: 'Double confirms selected actions or executes plugin targets.', pts: generateTickPoints() }
  ];

  // Load custom template registered gestures
  let customs: any[] = [];
  try {
    const stored = localStorage.getItem('inkos_custom_gestures');
    customs = stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error(e);
  }

  const customShapes = customs.map(t => ({
    name: t.name,
    desc: `Custom shape mapped to: [${t.actionId}]`,
    pts: t.normalizedPoints.map((p: any) => ({ x: p.x * 0.5 + 50, y: p.y * 0.5 + 40 })), // scale to fit card
    isCustom: true
  }));

  const allShapes = [...standardShapes, ...customShapes];

  grid.innerHTML = allShapes.map((s, idx) => `
    <div class="gesture-lib-card" data-idx="${idx}">
      <div class="gesture-card-header">
        <span class="gesture-lib-name">${s.name}</span>
        ${s.isCustom ? `
          <button class="delete-custom-gesture-btn" data-name="${s.name}" style="background: transparent; border: none; color: var(--color-danger); font-size: 0.85rem; cursor: pointer; padding: 2px;">✕</button>
        ` : `
          <input type="checkbox" checked style="accent-color: var(--color-cyan); width: 12px; height: 12px;" />
        `}
      </div>
      <canvas class="gesture-preview-canvas" id="lib-canvas-${idx}"></canvas>
      <span class="gesture-lib-desc">${s.desc}</span>
    </div>
  `).join('');

  // Setup loop animation for each canvas preview
  allShapes.forEach((s, idx) => {
    const canvas = document.getElementById(`lib-canvas-${idx}`) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale canvas resolution
    canvas.width = 150;
    canvas.height = 90;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#007AFF'; // iOS blue
    ctx.shadowColor = 'rgba(0, 122, 255, 0.3)';
    ctx.shadowBlur = 4;

    let progressIndex = 0;
    let pauseCounter = 0;

    const interval = setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (s.pts.length < 2) return;

      // Scaling factors to draw the coordinates centered on card canvas
      const scaleX = canvas.width / 100;
      const scaleY = canvas.height / 80;

      // Draw stroke path up to the current progressIndex
      ctx.beginPath();
      const firstX = s.pts[0].x * scaleX;
      const firstY = s.pts[0].y * scaleY;
      ctx.moveTo(firstX, firstY);

      for (let i = 1; i <= progressIndex; i++) {
        if (i >= s.pts.length) break;
        ctx.lineTo(s.pts[i].x * scaleX, s.pts[i].y * scaleY);
      }
      ctx.stroke();

      if (progressIndex < s.pts.length - 1) {
        progressIndex++;
      } else {
        // Pause at completion before restarting loop
        pauseCounter++;
        if (pauseCounter > 15) {
          progressIndex = 0;
          pauseCounter = 0;
        }
      }
    }, 45) as unknown as number;

    libraryAnimIntervals.push(interval);
  });

  // Wire delete custom buttons
  grid.querySelectorAll('.delete-custom-gesture-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = btn.getAttribute('data-name');
      if (name && confirm(`Delete custom gesture "${name}"?`)) {
        AudioSynth.playClick();
        try {
          const stored = localStorage.getItem('inkos_custom_gestures');
          const list = stored ? JSON.parse(stored) : [];
          const filtered = list.filter((item: any) => item.name.toLowerCase() !== name.toLowerCase());
          localStorage.setItem('inkos_custom_gestures', JSON.stringify(filtered));
          renderGestureLibrary();
        } catch (err) {
          console.error(err);
        }
      }
    });
  });
}

// Math generator coordinate functions for standard gestures loops
function generateCirclePoints() {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    pts.push({ x: 50 + 20 * Math.cos(angle), y: 40 + 16 * Math.sin(angle) });
  }
  return pts;
}

function generateUnderlinePoints() {
  const pts = [];
  for (let i = 0; i <= 20; i++) {
    pts.push({ x: 20 + i * 3, y: 40 });
  }
  return pts;
}

function generateArrowPoints() {
  const pts = [];
  for (let i = 0; i <= 12; i++) pts.push({ x: 25 + i * 3.5, y: 40 });
  pts.push({ x: 67, y: 40 });
  pts.push({ x: 57, y: 32 });
  pts.push({ x: 67, y: 40 });
  pts.push({ x: 57, y: 48 });
  return pts;
}

function generateLassoPoints() {
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const r = 18 + Math.sin(angle * 3) * 2.5;
    pts.push({ x: 50 + r * Math.cos(angle), y: 40 + r * Math.sin(angle) });
  }
  return pts;
}

function generateRectPoints() {
  const pts = [];
  for (let i = 0; i <= 5; i++) pts.push({ x: 25 + i * 10, y: 25 });
  for (let i = 0; i <= 4; i++) pts.push({ x: 75, y: 25 + i * 7.5 });
  for (let i = 0; i <= 5; i++) pts.push({ x: 75 - i * 10, y: 55 });
  for (let i = 0; i <= 4; i++) pts.push({ x: 25, y: 55 - i * 7.5 });
  return pts;
}

function generateCrossPoints() {
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push({ x: 35 + i * 3, y: 25 + i * 3 });
  for (let i = 0; i <= 10; i++) pts.push({ x: 65 - i * 3, y: 25 + i * 3 });
  return pts;
}

function generateQuestionPoints() {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const angle = Math.PI + (i / 12) * Math.PI * 1.5;
    pts.push({ x: 50 + 13 * Math.cos(angle), y: 32 + 10 * Math.sin(angle) });
  }
  pts.push({ x: 50, y: 42 });
  pts.push({ x: 50, y: 49 });
  pts.push({ x: 50, y: 57 }); // dot
  return pts;
}

function generateTickPoints() {
  const pts = [];
  for (let i = 0; i <= 5; i++) pts.push({ x: 30 + i * 3, y: 45 + i * 2.5 });
  for (let i = 0; i <= 8; i++) pts.push({ x: 45 + i * 3.2, y: 57.5 - i * 3.6 });
  return pts;
}

// 5. Showcase Play Buttons trigger
function initShowcasePlayButtons() {
  const btns = document.querySelectorAll('.play-showcase-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const workflow = btn.getAttribute('data-workflow');
      if (!workflow) return;
      
      AudioSynth.playClick();
      
      let targetId = '';
      let strokePoints: Point[] = [];

      if (workflow === 'translation') {
        targetId = 'txt-fr';
        const target = document.getElementById(targetId);
        if (target) {
          const rect = target.getBoundingClientRect();
          const steps = 15;
          const startX = rect.left + 15;
          const endX = rect.right - 15;
          const y = rect.bottom - 6;
          for (let i = 0; i <= steps; i++) {
            const pct = i / steps;
            strokePoints.push({
              x: startX + (endX - startX) * pct,
              y: y + Math.sin(pct * Math.PI) * 2,
              t: i * 20
            });
          }
        }
      } else if (workflow === 'math') {
        targetId = 'eq-1';
        const target = document.getElementById(targetId);
        if (target) {
          const rect = target.getBoundingClientRect();
          const steps = 24;
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const rx = rect.width / 2 + 10;
          const ry = rect.height / 2 + 8;
          for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            strokePoints.push({
              x: cx + rx * Math.cos(angle - Math.PI / 2),
              y: cy + ry * Math.sin(angle - Math.PI / 2),
              t: i * 20
            });
          }
        }
      } else if (workflow === 'visual') {
        targetId = 'img-watch';
        const target = document.getElementById(targetId);
        if (target) {
          const rect = target.getBoundingClientRect();
          const steps = 24;
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          const rx = rect.width / 2 + 15;
          const ry = rect.height / 2 + 15;
          for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const varR = 1 + Math.sin(angle * 4) * 0.04;
            strokePoints.push({
              x: cx + rx * Math.cos(angle - Math.PI / 2) * varR,
              y: cy + ry * Math.sin(angle - Math.PI / 2) * varR,
              t: i * 20
            });
          }
        }
      } else if (workflow === 'code') {
        targetId = 'code-block';
        const target = document.getElementById(targetId);
        if (target) {
          const rect = target.getBoundingClientRect();
          const cx = rect.left + rect.width / 2 + 20;
          const cy = rect.top + rect.height / 2 - 20;
          
          const qPoints = [
            { x: cx - 20, y: cy - 10 },
            { x: cx - 15, y: cy - 25 },
            { x: cx, y: cy - 30 },
            { x: cx + 15, y: cy - 25 },
            { x: cx + 20, y: cy - 10 },
            { x: cx + 10, y: cy + 5 },
            { x: cx, y: cy + 15 },
            { x: cx, y: cy + 25 },
            { x: cx, y: cy + 40 }
          ];

          for (let i = 0; i < qPoints.length; i++) {
            strokePoints.push({
              x: qPoints[i].x,
              y: qPoints[i].y,
              t: i * 40
            });
          }
        }
      }

      if (strokePoints.length > 0) {
        await replayStroke(strokePoints, `Workflow: ${workflow}`);
      }
    });
  });
}

// 6. Initialize interactive settings controls & composers
function initInteractivePortal() {
  initSettingsSearch();
  renderGestureLibrary();
  updateActivityHistoryUI();
  initShowcasePlayButtons();

  // Instantiate custom template composer
  const cCanvas = document.getElementById('composer-canvas') as HTMLCanvasElement;
  const cClear = document.getElementById('composer-clear-btn') as HTMLButtonElement;
  const cSave = document.getElementById('composer-save-btn') as HTMLButtonElement;
  const cName = document.getElementById('composer-name-input') as HTMLInputElement;
  const cAction = document.getElementById('composer-action-select') as HTMLSelectElement;

  if (cCanvas && cClear && cSave && cName && cAction) {
    new GestureComposer(cCanvas, cClear, cSave, cName, cAction, () => {
      inspector.addLog('system', 'Saved new custom gesture template. Reindexing library.');
      renderGestureLibrary();
    });
  }
}

// Execute Portal wire-up on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInteractivePortal);
} else {
  initInteractivePortal();
}

