import type { Point, ActionResult, Intent, BoundingBox, ContextElement, Gesture } from './sdk/types.ts';
import { GestureEngine } from './sdk/GestureEngine';
import { ContextEngine } from './sdk/ContextEngine';
import { IntentEngine } from './sdk/IntentEngine';
import { ActionEngine } from './sdk/ActionEngine';
import { PluginEngine } from './sdk/PluginEngine';
import { AudioSynth } from './sdk/AudioSynth';

// Global reusable <inkos-logo> Web Component
class InkOSLogo extends HTMLElement {
  static get observedAttributes() {
    return ['size', 'width', 'height', 'variant', 'class-name'];
  }
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }
  connectedCallback() { this.render(); }
  attributeChangedCallback() { this.render(); }
  render() {
    const size = this.getAttribute('size');
    const width = this.getAttribute('width') || size || 'auto';
    const height = this.getAttribute('height') || (size ? 'auto' : 'auto');
    const className = this.getAttribute('class-name') || '';
    const shadow = this.shadowRoot;
    if (!shadow) return;
    shadow.innerHTML = `
      <style>
        :host {
          display: inline-block;
          vertical-align: middle;
        }
        img {
          display: block;
          max-width: 100%;
          object-fit: contain;
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        img:hover {
          transform: scale(1.05);
        }
      </style>
      <img 
        src="/inkos_logo.png" 
        alt="InkOS Logo" 
        class="${className}" 
        style="width: ${width}; height: ${height};"
      />
    `;
  }
}
customElements.define('inkos-logo', InkOSLogo);

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



// Multi-selection targets
let selectedTargets: { element: HTMLElement; bounds: BoundingBox; content: string }[] = [];
let activeHighlights: HTMLElement[] = [];
let activeIntentTargets: { element: HTMLElement; bounds: DOMRect; actionId: string }[] = [];
let activeConfirmationPill: HTMLDivElement | null = null;
let lastDrawnPoints: Point[] = [];

function addSelectedTarget(element: HTMLElement, bounds: BoundingBox) {
  if (selectedTargets.some(t => t.element === element)) return;
  const content = element.getAttribute('data-inkos-content') || element.innerText || '';
  selectedTargets.push({ element, bounds, content });
  inspector.addLog('system', `Selection added: "${content.substring(0, 20)}...". Total items: ${selectedTargets.length}`);
}

function clearSelections() {
  selectedTargets = [];
  activeHighlights.forEach(h => h.remove());
  activeHighlights = [];
  removeIntentTargets();
  removeConfirmationPill();
}

function showSelectionsHighlight() {
  activeHighlights.forEach(h => h.remove());
  activeHighlights = [];
  
  selectedTargets.forEach(target => {
    const rect = target.element.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'inkos-active-highlight-box';
    highlight.style.position = 'fixed';
    highlight.style.left = `${rect.left - 4}px`;
    highlight.style.top = `${rect.top - 4}px`;
    highlight.style.width = `${rect.width + 8}px`;
    highlight.style.height = `${rect.height + 8}px`;
    
    if (selectedTargets.length >= 2) {
      highlight.style.border = '2.5px dashed var(--color-cyan)';
    } else {
      highlight.style.border = '2.5px solid var(--color-cyan)';
    }
    
    highlight.style.borderRadius = '12px';
    highlight.style.boxShadow = '0 0 15px rgba(0, 241, 252, 0.4), inset 0 0 8px rgba(0, 241, 252, 0.2)';
    highlight.style.pointerEvents = 'none';
    highlight.style.zIndex = '99990';
    highlight.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
    highlight.style.animation = 'highlightGlow 1.5s infinite alternate ease-in-out';
    
    document.body.appendChild(highlight);
    activeHighlights.push(highlight);
  });
}

function renderIntentTargets(originBounds: BoundingBox, contextType: string) {
  removeIntentTargets();
  
  let targetsConfig: { actionId: string; icon: string; label: string }[] = [];
  
  if (contextType === 'math') {
    targetsConfig = [
      { actionId: 'math_solve', icon: '🧮', label: 'Solve' },
      { actionId: 'math_graph', icon: '📊', label: 'Graph' },
      { actionId: 'notes_save', icon: '📝', label: 'Notes' },
      { actionId: 'share', icon: '📤', label: 'Share' }
    ];
  } else if (contextType === 'image') {
    targetsConfig = [
      { actionId: 'image_search', icon: '🔍', label: 'Search' },
      { actionId: 'image_save', icon: '🖼', label: 'Save' },
      { actionId: 'image_describe', icon: '✨', label: 'Describe' },
      { actionId: 'share', icon: '📤', label: 'Share' }
    ];
  } else if (contextType === 'code') {
    targetsConfig = [
      { actionId: 'explain_code', icon: '⚡', label: 'Explain' },
      { actionId: 'debug_code', icon: '🐞', label: 'Debug' },
      { actionId: 'notes_save', icon: '📝', label: 'Notes' },
      { actionId: 'share', icon: '📤', label: 'Share' }
    ];
  } else if (contextType === 'text') {
    const isDateOrTime = /friday|monday|tuesday|wednesday|thursday|saturday|sunday|today|tomorrow|pm|am|clock|august|january|september/i.test(selectedTargets[0]?.content || '');
    if (isDateOrTime) {
      targetsConfig = [
        { actionId: 'calendar_add', icon: '📅', label: 'Calendar' },
        { actionId: 'reminder_set', icon: '⏰', label: 'Reminder' },
        { actionId: 'task_create', icon: '📝', label: 'Task' },
        { actionId: 'share', icon: '📤', label: 'Share' }
      ];
    } else {
      targetsConfig = [
        { actionId: 'explain', icon: '✨', label: 'Explain' },
        { actionId: 'translate', icon: '🌍', label: 'Translate' },
        { actionId: 'notes_save', icon: '📝', label: 'Notes' },
        { actionId: 'share', icon: '📤', label: 'Share' }
      ];
    }
  } else {
    targetsConfig = [
      { actionId: 'explain', icon: '✨', label: 'AI' },
      { actionId: 'notes_save', icon: '📝', label: 'Notes' },
      { actionId: 'share', icon: '📤', label: 'Share' }
    ];
  }

  // Calculate coordinates and append nodes (Top, Right, Bottom, Left)
  const centerX = originBounds.x + originBounds.width / 2;
  const centerY = originBounds.y + originBounds.height / 2;
  const offsets = [
    { x: centerX - 30, y: originBounds.y - 70 }, // Top
    { x: originBounds.x + originBounds.width + 30, y: centerY - 30 }, // Right
    { x: centerX - 30, y: originBounds.y + originBounds.height + 30 }, // Bottom
    { x: originBounds.x - 90, y: centerY - 30 } // Left
  ];

  targetsConfig.forEach((cfg, idx) => {
    const offset = offsets[idx];
    if (!offset) return;

    const el = document.createElement('div');
    el.className = 'inkos-intent-target';
    el.innerHTML = `
      <div class="target-icon" style="font-size: 1.3rem;">${cfg.icon}</div>
      <div class="target-label" style="font-size: 0.62rem; opacity: 0.8; margin-top: 2px;">${cfg.label}</div>
    `;
    el.style.position = 'fixed';
    el.style.left = `${offset.x}px`;
    el.style.top = `${offset.y}px`;
    el.style.width = '60px';
    el.style.height = '60px';
    el.style.borderRadius = '50%';
    el.style.background = 'rgba(255, 255, 255, 0.78)';
    el.style.backdropFilter = 'blur(10px)';
    el.style.border = '1px solid rgba(0, 241, 252, 0.25)';
    el.style.boxShadow = 'var(--glass-shadow)';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.zIndex = '99995';
    el.style.cursor = 'pointer';
    el.style.transition = 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)';
    el.style.animation = 'pillPop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';

    document.body.appendChild(el);
    
    activeIntentTargets.push({
      element: el,
      bounds: el.getBoundingClientRect(),
      actionId: cfg.actionId
    });
  });
}

function removeIntentTargets() {
  activeIntentTargets.forEach(t => t.element.remove());
  activeIntentTargets = [];
}

function checkArrowLanding(endPt: Point): { actionId: string; element: HTMLElement } | null {
  for (const target of activeIntentTargets) {
    const bounds = target.bounds;
    const isInside = endPt.x >= bounds.left && endPt.x <= bounds.right && endPt.y >= bounds.top && endPt.y <= bounds.bottom;
    if (isInside) {
      return { actionId: target.actionId, element: target.element };
    }
  }
  return null;
}

function showConfirmationPill(actionId: string, targetEl: HTMLElement, confirmCallback: () => void) {
  removeConfirmationPill();
  
  const pill = document.createElement('div');
  pill.className = 'vision-action-pill';
  pill.style.position = 'fixed';
  
  const rect = targetEl.getBoundingClientRect();
  pill.style.left = `${rect.left - 50}px`;
  pill.style.top = `${rect.bottom + 12}px`;
  pill.style.width = '200px';
  pill.style.padding = '10px';
  pill.style.display = 'flex';
  pill.style.flexDirection = 'column';
  pill.style.gap = '8px';
  pill.style.zIndex = '99999';
  
  let desc = 'Confirm action?';
  if (actionId === 'calendar_add') desc = 'Add event to Calendar?';
  else if (actionId === 'reminder_set') desc = 'Set Deadline Reminder?';
  else if (actionId === 'task_create') desc = 'Add task entry?';
  else if (actionId === 'share') desc = 'Share selection?';
  else if (actionId === 'notes_save') desc = 'Archive note?';
  else if (actionId === 'image_search') desc = 'Visual search items?';
  else if (actionId === 'image_save') desc = 'Save image asset?';
  else if (actionId === 'compare') desc = 'Compare elements?';
  
  pill.innerHTML = `
    <div style="font-size: 0.78rem; font-weight: 600; color: var(--text-primary); text-align: center;">${desc}</div>
    <div style="display: flex; gap: 8px; justify-content: center; width: 100%;">
      <button id="inkos-confirm-yes" class="btn-primary" style="flex: 1; font-size: 0.72rem; padding: 6px 12px; margin: 0; background: var(--color-cyan); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Confirm</button>
      <button id="inkos-confirm-no" class="composer-btn-sm" style="flex: 1; font-size: 0.72rem; padding: 6px 12px; margin: 0; border-radius: 6px; cursor: pointer;">Cancel</button>
    </div>
  `;
  
  document.body.appendChild(pill);
  activeConfirmationPill = pill;
  
  const yesBtn = pill.querySelector('#inkos-confirm-yes') as HTMLElement;
  const noBtn = pill.querySelector('#inkos-confirm-no') as HTMLElement;
  
  yesBtn.addEventListener('click', () => {
    AudioSynth.playPop();
    removeConfirmationPill();
    removeIntentTargets();
    confirmCallback();
  });
  
  noBtn.addEventListener('click', () => {
    AudioSynth.playClick();
    transitionToState('IDLE');
  });
}

function removeConfirmationPill() {
  if (activeConfirmationPill) {
    activeConfirmationPill.remove();
    activeConfirmationPill = null;
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

      
      // Clear all active selection arrays
      clearSelections();
      
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
      
      // Render Intent Targets if drawing with an active selection
      if (selectedTargets.length > 0) {
        const primaryTarget = selectedTargets[0];
        const cType = primaryTarget.element.getAttribute('data-inkos-type') || 'text';
        renderIntentTargets(primaryTarget.bounds, cType);
      }
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
let dragStartX = 0;
let dragStartY = 0;

window.addEventListener('pointerdown', (e) => {
  const target = e.target as HTMLElement;
  
  if (currentState === 'ACTION_MENU') {
    const menuEl = document.querySelector('.vision-action-pill');
    const clickedOrb = orbEl && orbEl.contains(target);
    const isInsideMenu = (menuEl && menuEl.contains(target)) || 
                         (activeConfirmationPill && activeConfirmationPill.contains(target)) ||
                         activeIntentTargets.some(t => t.element.contains(target));
    
    if (!isInsideMenu && !clickedOrb) {
      // Intercept the pointerdown event
      e.stopPropagation();
      
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      
      const handleMove = (moveEv: PointerEvent) => {
        const dx = moveEv.clientX - dragStartX;
        const dy = moveEv.clientY - dragStartY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 8) {
          window.removeEventListener('pointermove', handleMove, true);
          window.removeEventListener('pointerup', handleUp, true);
          
          actionMenu.hide();
          removeConfirmationPill();
          
          transitionToState('DRAWING');
          
          const canvasDownEv = new PointerEvent('pointerdown', {
            clientX: moveEv.clientX,
            clientY: moveEv.clientY,
            pointerId: moveEv.pointerId,
            bubbles: true
          });
          canvasElement.dispatchEvent(canvasDownEv);
        }
      };
      
      const handleUp = () => {
        window.removeEventListener('pointermove', handleMove, true);
        window.removeEventListener('pointerup', handleUp, true);
        AudioSynth.playClick();
        transitionToState('IDLE');
      };
      
      window.addEventListener('pointermove', handleMove, true);
      window.addEventListener('pointerup', handleUp, true);
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

// Global window pointermove listener to highlight active Intent Targets in real-time
window.addEventListener('pointermove', (e) => {
  if (currentState === 'DRAWING' && activeIntentTargets.length > 0) {
    const x = e.clientX;
    const y = e.clientY;
    
    activeIntentTargets.forEach(target => {
      const bounds = target.bounds;
      const isInside = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
      
      if (isInside) {
        target.element.style.background = 'rgba(0, 241, 252, 0.18)';
        target.element.style.border = '2px solid #00F1FC';
        target.element.style.boxShadow = '0 0 15px rgba(0, 241, 252, 0.5)';
        target.element.style.transform = 'scale(1.15)';
      } else {
        target.element.style.background = 'rgba(255, 255, 255, 0.78)';
        target.element.style.border = '1px solid rgba(0, 241, 252, 0.25)';
        target.element.style.boxShadow = 'var(--glass-shadow)';
        target.element.style.transform = 'scale(1)';
      }
    });
  }
});

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

// Global Intent Execution Routine
async function executeIntent(selectedIntent: Intent, executePosPage: { x: number; y: number }, context: ContextElement, gesture?: Gesture) {
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
    const dummyGesture: Gesture = gesture || {
      type: selectedIntent.gesture,
      confidence: 1.0,
      bounds: context.bounds,
      points: lastDrawnPoints
    };
    
    if (selectedIntent.id.includes(':')) {
      inspector.addLog('action', `Delegating action request to plugin: [${selectedIntent.id}]`);
      result = await pluginEngine.executeIntent(selectedIntent.id, context, dummyGesture);
    } else {
      inspector.addLog('action', `Executing core system action: [${selectedIntent.id}]`);
      result = await ActionEngine.execute(selectedIntent.id, context, dummyGesture);
    }

    inspector.updateActionTelemetry(selectedIntent.id, result);

    if (result.success) {
      logActivityEntry(dummyGesture.type, context.type, selectedIntent.label, lastDrawnPoints, true);
      if (controlCenter) {
        controlCenter.setOrbState('completed');
        setTimeout(() => controlCenter.setOrbState('idle'), 1000);
      }
      // Success toasts / Discovery moments
      if (selectedIntent.id.includes('translate')) {
        showDiscoveryToast('🌍 Translated successfully!');
      } else if (selectedIntent.id.includes('calendar')) {
        showDiscoveryToast('📅 Added to Calendar!');
      } else if (selectedIntent.id.includes('copy')) {
        showDiscoveryToast('📋 Copied to Clipboard!');
      } else if (selectedIntent.id.includes('math_solve')) {
        showDiscoveryToast('🧮 Equation solved successfully!');
      } else if (selectedIntent.id.includes('compare')) {
        showDiscoveryToast('⚡ Spec Comparison Ready!');
      } else {
        showDiscoveryToast(`✓ Action completed: ${selectedIntent.label}`);
      }
    } else {
      logActivityEntry(dummyGesture.type, context.type, selectedIntent.label, lastDrawnPoints, false);
      if (controlCenter) {
        controlCenter.setOrbState('idle');
      }
    }

    if (result.success && result.displayHtml) {
      // Play action success pop sound
      AudioSynth.playClick();

      const targetElement = context.element;
      let resultPosPage = { ...executePosPage };
      
      if (context.type !== 'empty' && targetElement && targetElement !== document.body) {
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
    logActivityEntry(selectedIntent.gesture, context.type, selectedIntent.label, lastDrawnPoints, false);
    inspector.addLog('system', `🚨 SDK Engine Error: ${e.message || e}`);
    transitionToState('IDLE');
  }
}

// Core Gesture Drawing complete callback
async function handleGestureComplete(points: Point[], forcedGestureType?: string): Promise<void> {
  const startTime = performance.now();
  lastDrawnPoints = points;

  // 1. Gesture recognition heuristics
  const gesture = GestureEngine.recognize(points);
  if (forcedGestureType) {
    gesture.type = forcedGestureType;
    gesture.confidence = 1.0;
  }

  // 2. Context element boundaries scan
  const context = ContextEngine.detectContext(gesture.bounds, document.body);

  // 3. Predict intents
  const intents = IntentEngine.predict(gesture, context, pluginEngine);

  const endTime = performance.now();
  const latency = endTime - startTime;

  // 4. Update left inspector panel metrics and logger
  inspector.updateTelemetry(gesture, context, latency, intents);

  // Calculate coordinates & centroids
  const centroidX = gesture.points.reduce((sum, p) => sum + p.x, 0) / gesture.points.length;
  const centroidY = gesture.points.reduce((sum, p) => sum + p.y, 0) / gesture.points.length;
  const endPt = gesture.points[gesture.points.length - 1];

  // Recovery UI for LOW confidence gestures
  if (gesture.confidence < 0.45 && !forcedGestureType) {
    const recoveryIntents: Intent[] = [
      {
        id: 'recovery_circle',
        label: '⭕ Select Area',
        description: 'Interpret drawing as selection loop',
        score: 1.0,
        icon: '⭕',
        gesture: 'circle',
        context: 'empty'
      },
      {
        id: 'recovery_underline',
        label: '〰 Focus/Understand',
        description: 'Interpret drawing as focus underline',
        score: 0.9,
        icon: '〰',
        gesture: 'underline',
        context: 'empty'
      },
      {
        id: 'recovery_arrow',
        label: '→ Connect/Route',
        description: 'Interpret drawing as arrow target',
        score: 0.8,
        icon: '→',
        gesture: 'arrow',
        context: 'empty'
      },
      {
        id: 'recovery_cancel',
        label: '❌ Cancel',
        description: 'Discard active drawing',
        score: 0.7,
        icon: '❌',
        gesture: 'unknown',
        context: 'empty'
      }
    ];

    transitionToState('ACTION_MENU');
    actionMenu.show(recoveryIntents, { x: centroidX + window.scrollX, y: centroidY + window.scrollY }, async (intent) => {
      if (intent.id === 'recovery_circle') {
        handleGestureComplete(points, 'circle');
      } else if (intent.id === 'recovery_underline') {
        handleGestureComplete(points, 'underline');
      } else if (intent.id === 'recovery_arrow') {
        handleGestureComplete(points, 'arrow');
      } else {
        transitionToState('IDLE');
      }
    });
    return;
  }

  // Recovery UI for MEDIUM confidence gestures
  if (gesture.confidence >= 0.45 && gesture.confidence < 0.75 && !forcedGestureType) {
    const mediumIntents: Intent[] = [
      {
        id: 'medium_accept',
        label: `⭕ Confirm ${gesture.type.toUpperCase()}`,
        description: `Looks like a ${gesture.type} selection`,
        score: 1.0,
        icon: '⭕',
        gesture: gesture.type,
        context: 'empty'
      },
      {
        id: 'medium_alternate',
        label: '〰 Underline Content',
        description: 'Analyze as focus/understand',
        score: 0.9,
        icon: '〰',
        gesture: 'underline',
        context: 'empty'
      },
      {
        id: 'medium_cancel',
        label: '❌ Cancel',
        description: 'Discard active drawing',
        score: 0.8,
        icon: '❌',
        gesture: 'unknown',
        context: 'empty'
      }
    ];

    transitionToState('ACTION_MENU');
    actionMenu.show(mediumIntents, { x: centroidX + window.scrollX, y: centroidY + window.scrollY }, async (intent) => {
      if (intent.id === 'medium_accept') {
        handleGestureComplete(points, gesture.type);
      } else if (intent.id === 'medium_alternate') {
        handleGestureComplete(points, 'underline');
      } else {
        transitionToState('IDLE');
      }
    });
    return;
  }

  // A. Check if we have targets selected
  if (selectedTargets.length > 0) {
    // A1. Check if user drew an ARROW pointing at an Intent Target
    if (gesture.type === 'arrow') {
      const landing = checkArrowLanding(endPt);
      if (landing) {
        const primaryTarget = selectedTargets[0];
        const syntheticContext: ContextElement = {
          id: primaryTarget.element.id || 'ctx_arrow',
          type: primaryTarget.element.getAttribute('data-inkos-type') as any || 'text',
          content: primaryTarget.content,
          bounds: primaryTarget.bounds,
          element: primaryTarget.element
        };
        
        const syntheticIntent: Intent = {
          id: landing.actionId,
          label: landing.actionId.replace('_', ' '),
          description: 'Executed via Arrow connection target',
          score: 1.0,
          icon: '→',
          gesture: 'arrow',
          context: syntheticContext.type
        };
        
        transitionToState('ACTION_MENU');
        showConfirmationPill(landing.actionId, landing.element, async () => {
          await executeIntent(syntheticIntent, {
            x: landing.element.getBoundingClientRect().left + window.scrollX,
            y: landing.element.getBoundingClientRect().bottom + window.scrollY + 12
          }, syntheticContext, gesture);
        });
        return;
      }
    }
    
    // A2. Check if user drew a CHECKMARK ✓ on selection
    if (gesture.type === 'tick') {
      const primaryTarget = selectedTargets[0];
      const syntheticContext: ContextElement = {
        id: primaryTarget.element.id || 'ctx_tick',
        type: primaryTarget.element.getAttribute('data-inkos-type') as any || 'text',
        content: primaryTarget.content,
        bounds: primaryTarget.bounds,
        element: primaryTarget.element
      };
      
      const intents = IntentEngine.predict(gesture, syntheticContext, pluginEngine);
      if (intents.length > 0) {
        transitionToState('ACTION_MENU');
        showConfirmationPill(intents[0].id, primaryTarget.element, async () => {
          await executeIntent(intents[0], {
            x: centroidX + window.scrollX,
            y: centroidY + window.scrollY
          }, syntheticContext, gesture);
        });
        return;
      }
    }

    // A3. Check if user drew a leftrightarrow ↔ or connecting line between two elements
    if (gesture.type === 'leftrightarrow' && selectedTargets.length >= 2) {
      const compareContext: ContextElement = {
        id: 'compare_ctx',
        type: 'text',
        content: `${selectedTargets[0].content} vs ${selectedTargets[1].content}`,
        bounds: gesture.bounds,
        element: document.body,
        metadata: {
          compareItems: [...selectedTargets]
        }
      };
      
      const intents = IntentEngine.predict(gesture, compareContext, pluginEngine);
      if (intents.length > 0) {
        transitionToState('ACTION_MENU');
        actionMenu.show(intents, {
          x: centroidX + window.scrollX,
          y: centroidY + window.scrollY
        }, async (intent) => {
          await executeIntent(intent, {
            x: centroidX + window.scrollX,
            y: centroidY + window.scrollY
          }, compareContext, gesture);
        });
        return;
      }
    }
  }

  // B. Fallback to standard context detection
  if (gesture.type === 'unknown' && context.type === 'empty') {
    inspector.addLog('system', 'Drawing unrecognized. Clearing selections.');
    transitionToState('IDLE');
    return;
  }

  // If gesture is a CIRCLE, we add it to the multi-selection targets!
  if (gesture.type === 'circle' || gesture.type === 'lasso' || gesture.type === 'rectangle') {
    if (context.type !== 'empty' && context.element) {
      addSelectedTarget(context.element, context.bounds);
      showSelectionsHighlight();
      
      const intents = IntentEngine.predict(gesture, context, pluginEngine);
      
      let pillX = centroidX;
      let pillY = centroidY;
      const targetRect = context.element.getBoundingClientRect();
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

      const targetBoundsPage = {
        x: targetRect.left + window.scrollX,
        y: targetRect.top + window.scrollY,
        width: targetRect.width,
        height: targetRect.height
      };

      transitionToState('PROCESSING_SELECTION');
      canvasOverlay.animateMorph(pillX, pillY, async () => {
        transitionToState('ACTION_MENU');
        
        actionMenu.show(intents, {
          x: pillX + window.scrollX,
          y: pillY + window.scrollY
        }, async (intent) => {
          await executeIntent(intent, {
            x: pillX + window.scrollX,
            y: pillY + window.scrollY
          }, context, gesture);
        }, targetBoundsPage);
      });
      return;
    }
  }

  // C. General single-gesture non-selection trigger path
  if (context.type !== 'empty' && context.element) {
    addSelectedTarget(context.element, context.bounds);
    showSelectionsHighlight();
  }

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

  transitionToState('PROCESSING_SELECTION');
  canvasOverlay.animateMorph(pillX, pillY, async () => {
    const modeSelect = document.getElementById('mode-select') as HTMLSelectElement;
    const isAutoMode = modeSelect && modeSelect.value === 'auto';

    const pillPosPage = {
      x: pillX + window.scrollX,
      y: pillY + window.scrollY
    };

    if (isAutoMode && intents.length > 0) {
      inspector.addLog('system', `Default execution mode set to IMMEDIATE. Auto-triggering: ${intents[0].label}`);
      await executeIntent(intents[0], pillPosPage, context, gesture);
    } else {
      transitionToState('ACTION_MENU');
      actionMenu.show(intents, pillPosPage, async (intent) => {
        await executeIntent(intent, pillPosPage, context, gesture);
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

// Discovery Moments and Success toasts
let toastTimeout: any = null;
function showDiscoveryToast(message: string) {
  let toast = document.getElementById('discovery-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'discovery-toast';
    toast.style.position = 'fixed';
    toast.style.bottom = '24px';
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.background = 'rgba(28, 28, 30, 0.95)';
    toast.style.color = '#FFFFFF';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '30px';
    toast.style.fontSize = '0.85rem';
    toast.style.fontWeight = '600';
    toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
    toast.style.zIndex = '1000000';
    toast.style.transition = 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)';
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 20px)';
    document.body.appendChild(toast);
  }

  if (toastTimeout) {
    clearTimeout(toastTimeout);
  }

  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translate(-50%, 0)';

  toastTimeout = setTimeout(() => {
    if (toast) {
      toast.style.opacity = '0';
      toast.style.transform = 'translate(-50%, 20px)';
    }
  }, 4000);
}

// 6. Initialize interactive settings controls & composers
function initInteractivePortal() {
  initSettingsSearch();
  renderGestureLibrary();
  updateActivityHistoryUI();
  initShowcasePlayButtons();
  
  // Interactive Hero setup
  const tryLiveBtn = document.getElementById('hero-try-inkos-live');
  if (tryLiveBtn) {
    tryLiveBtn.addEventListener('click', () => {
      AudioSynth.playRipple();
      toggleInkOverlay(true);
      showDiscoveryToast('InkOS active. Circle ⭕ or underline 〰 items below!');
    });
  }

  const watchDemoBtn = document.getElementById('hero-watch-demo');
  if (watchDemoBtn) {
    watchDemoBtn.addEventListener('click', () => {
      const playBtn = document.querySelector('.play-showcase-btn[data-workflow="translation"]') as HTMLElement;
      if (playBtn) {
        playBtn.click();
      } else {
        showDiscoveryToast('Starting simulated walkthrough...');
      }
    });
  }

  // Gesture Playground initializer
  initGesturePlayground();

  // One Gesture Different Intent initializer
  initDifferentIntentShowcase();

  // Live Pipeline Visualizer initializer
  initPipelineVisualizer();

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

function initGesturePlayground() {
  const cards = document.querySelectorAll('.playground-gesture-card');
  const sandboxContent = document.getElementById('playground-sandbox-content');
  const guidelineOverlay = document.getElementById('playground-guideline-overlay');

  if (!cards.length || !sandboxContent || !guidelineOverlay) return;
  const contentEl = sandboxContent;
  const overlayEl = guidelineOverlay;

  const templates: Record<string, { html: string; guidelineSvg: string }> = {
    circle: {
      html: `<div class="inkos-target" id="playground-target-circle" data-inkos-type="text" data-inkos-content="Bonjour, comment ça va?" style="background: #FFFFFF; border: 1px solid var(--glass-border); border-radius: var(--radius-inner); padding: 24px; font-size: 1.15rem; width: 100%; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">🇫🇷 Bonjour, comment ça va?</div>`,
      guidelineSvg: `<svg width="300" height="120" style="position: absolute; overflow: visible;">
        <circle cx="150" cy="60" r="45" fill="none" stroke="rgba(0, 122, 255, 0.25)" stroke-width="2.5" stroke-dasharray="6 6" />
      </svg>`
    },
    underline: {
      html: `<div class="inkos-target" id="playground-target-underline" data-inkos-type="text" data-inkos-content="Underline this statement to analyze context." style="background: #FFFFFF; border: 1px solid var(--glass-border); border-radius: var(--radius-inner); padding: 24px; font-size: 1.05rem; width: 100%; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">Underline this statement to get deep semantic context analysis.</div>`,
      guidelineSvg: `<svg width="350" height="120" style="position: absolute; overflow: visible;">
        <path d="M 40 85 L 310 85" fill="none" stroke="rgba(0, 122, 255, 0.25)" stroke-width="2.5" stroke-dasharray="6 6" />
      </svg>`
    },
    arrow: {
      html: `<div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 24px; padding: 12px;">
        <div class="inkos-target" id="playground-target-arrow-src" data-inkos-type="text" data-inkos-content="Project Checklist Details" style="background: #FFFFFF; border: 1px solid var(--glass-border); border-radius: var(--radius-inner); padding: 18px; font-size: 0.95rem; flex: 1; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">Project Hand-off Checklist</div>
        <div style="width: 55px; height: 55px; border-radius: 50%; border: 2.5px dashed rgba(0,122,255,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: var(--color-cyan); background: rgba(0,122,255,0.03);" title="Task Destination">📝</div>
      </div>`,
      guidelineSvg: `<svg width="350" height="120" style="position: absolute; overflow: visible; left: 60px;">
        <path d="M 220 60 L 300 60 M 285 50 L 300 60 L 285 70" fill="none" stroke="rgba(0, 122, 255, 0.25)" stroke-width="2.5" stroke-dasharray="6 6" />
      </svg>`
    },
    compare: {
      html: `<div style="display: flex; gap: 16px; width: 100%; padding: 6px;">
        <div class="sim-product-card inkos-target" id="playground-compare-a" data-inkos-type="image" data-inkos-content="Heritage Watch" style="background: #FFFFFF; border: 1px solid var(--glass-border); border-radius: var(--radius-inner); padding: 14px; flex: 1; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
          <strong style="font-size: 0.85rem; display: block; margin-bottom: 4px;">Heritage Automatic</strong>
          <span style="font-size: 0.82rem; color: var(--color-cyan); font-weight: 600;">$249.00</span>
        </div>
        <div class="sim-product-card inkos-target" id="playground-compare-b" data-inkos-type="image" data-inkos-content="Vanguard Watch" style="background: #FFFFFF; border: 1px solid var(--glass-border); border-radius: var(--radius-inner); padding: 14px; flex: 1; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
          <strong style="font-size: 0.85rem; display: block; margin-bottom: 4px;">Vanguard Smart</strong>
          <span style="font-size: 0.82rem; color: var(--color-cyan); font-weight: 600;">$199.00</span>
        </div>
      </div>`,
      guidelineSvg: `<svg width="300" height="120" style="position: absolute; overflow: visible;">
        <path d="M 50 60 L 250 60" fill="none" stroke="rgba(0, 122, 255, 0.25)" stroke-width="2.5" stroke-dasharray="6 6" />
      </svg>`
    },
    tick: {
      html: `<div class="inkos-target" id="playground-target-tick" data-inkos-type="text" data-inkos-content="Design Meeting Friday at 3:00 PM" style="background: #FFFFFF; border: 1px solid var(--glass-border); border-radius: var(--radius-inner); padding: 24px; font-size: 1.05rem; width: 100%; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">📅 Design Meeting: Friday at 3:00 PM</div>`,
      guidelineSvg: `<svg width="300" height="120" style="position: absolute; overflow: visible;">
        <path d="M 120 50 L 150 75 L 200 35" fill="none" stroke="rgba(0, 122, 255, 0.25)" stroke-width="2.5" stroke-dasharray="6 6" />
      </svg>`
    }
  };

  function loadPlayground(key: string) {
    const sc = templates[key];
    contentEl.innerHTML = sc.html;
    overlayEl.innerHTML = sc.guidelineSvg;
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => {
        c.classList.remove('active');
        (c as HTMLElement).style.borderColor = 'var(--glass-border)';
        (c as HTMLElement).style.boxShadow = 'none';
        (c as HTMLElement).style.background = 'var(--bg-graphite)';
      });
      card.classList.add('active');
      (card as HTMLElement).style.borderColor = 'var(--color-cyan)';
      (card as HTMLElement).style.boxShadow = 'var(--glass-shadow)';
      (card as HTMLElement).style.background = 'rgba(0, 122, 255, 0.02)';

      const gestureKey = card.getAttribute('data-gesture') || 'circle';
      loadPlayground(gestureKey);
      
      AudioSynth.playPop();
    });
  });

  loadPlayground('circle');
}

function initDifferentIntentShowcase() {
  const tabs = document.querySelectorAll('.intent-tab-btn');
  const simScreen = document.getElementById('intent-sim-screen');
  const canvas = document.getElementById('intent-sim-canvas') as HTMLCanvasElement;
  
  if (!tabs.length || !simScreen || !canvas) return;
  const screenEl = simScreen;
  const canvasEl = canvas;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) return;
  const ctxEl = ctx;
  
  const scenarios: Record<string, { html: string; resultHtml: string }> = {
    math: {
      html: `<div style="font-size: 1.8rem; font-family: var(--font-mono); font-weight: 700; color: var(--color-cyan);">125 × 8</div>`,
      resultHtml: `<div class="intent-sim-result-tag" style="background: rgba(0, 122, 255, 0.06); border: 1px solid rgba(0, 122, 255, 0.2); padding: 8px 16px; border-radius: var(--radius-inner); font-family: var(--font-mono); font-size: 0.9rem;">
        <span style="color: var(--text-secondary);">Result:</span> <strong style="color: var(--color-cyan);">1000</strong>
      </div>`
    },
    translate: {
      html: `<div style="font-size: 1.1rem; line-height: 1.4;">"Bonjour, comment allez-vous?"</div>`,
      resultHtml: `<div class="intent-sim-result-tag" style="background: rgba(48, 209, 88, 0.06); border: 1px solid rgba(48, 209, 88, 0.2); padding: 8px 16px; border-radius: var(--radius-inner); font-size: 0.85rem;">
        <span>Translated:</span> <strong style="color: var(--color-success);">"Hello, how are you?"</strong>
      </div>`
    },
    event: {
      html: `<div style="font-size: 1.1rem; line-height: 1.4;">"Design meeting Friday at 4 PM"</div>`,
      resultHtml: `<div class="intent-sim-result-tag" style="background: rgba(0, 122, 255, 0.06); border: 1px solid rgba(0, 122, 255, 0.2); padding: 8px 16px; border-radius: var(--radius-inner); font-size: 0.85rem;">
        📅 <strong>Calendar:</strong> Design Review added (Fri 4:00 PM)
      </div>`
    },
    code: {
      html: `<pre style="font-family: var(--font-mono); font-size: 0.8rem; background: rgba(0,0,0,0.02); padding: 12px; border-radius: 8px; text-align: left; margin: 0; width: 100%;"><code>console.log('Final Calculated Price:', '$' + price);</code></pre>`,
      resultHtml: `<div class="intent-sim-result-tag" style="background: rgba(192, 132, 252, 0.06); border: 1px solid rgba(192, 132, 252, 0.2); padding: 8px 16px; border-radius: var(--radius-inner); font-size: 0.8rem; text-align: left; max-width: 250px;">
        💡 <strong>Explain:</strong> Outputs the formatted final calculated price with a dollar sign prefix.
      </div>`
    },
    products: {
      html: `<div style="display: flex; gap: 12px; justify-content: center; width: 100%;">
        <div style="border: 1px solid var(--glass-border); padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; background: white;">Heritage Watch ($249)</div>
        <div style="border: 1px solid var(--glass-border); padding: 6px 12px; border-radius: 8px; font-size: 0.75rem; background: white;">Vanguard Watch ($199)</div>
      </div>`,
      resultHtml: `<div class="intent-sim-result-tag" style="background: rgba(0, 122, 255, 0.06); border: 1px solid rgba(0, 122, 255, 0.2); padding: 8px 16px; border-radius: var(--radius-inner); font-size: 0.78rem;">
        ⚖️ <strong>Specs Comparison Table</strong> matches 2 watches.
      </div>`
    }
  };

  let animationFrameId: number | null = null;

  function runDemo(intentId: string) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    
    const sc = scenarios[intentId];
    screenEl.innerHTML = sc.html;
    
    let frame = 0;
    const cx = canvasEl.width / 2;
    const cy = canvasEl.height / 2;
    const r = 55;
    
    function draw() {
      ctxEl.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctxEl.beginPath();
      ctxEl.strokeStyle = '#007AFF';
      ctxEl.lineWidth = 3.5;
      ctxEl.shadowColor = '#007AFF';
      ctxEl.shadowBlur = 8;
      
      const progress = Math.min(1.0, frame / 25);
      ctxEl.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctxEl.stroke();
      
      if (frame < 25) {
        frame++;
        animationFrameId = requestAnimationFrame(draw);
      } else {
        const resDiv = document.createElement('div');
        resDiv.style.marginTop = '14px';
        resDiv.innerHTML = sc.resultHtml;
        screenEl.appendChild(resDiv);
      }
    }
    
    draw();
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        (t as HTMLElement).style.background = 'transparent';
        (t as HTMLElement).style.borderColor = 'transparent';
        const strong = t.querySelector('strong');
        if (strong) strong.style.color = 'var(--text-primary)';
      });
      tab.classList.add('active');
      (tab as HTMLElement).style.background = 'var(--bg-graphite)';
      (tab as HTMLElement).style.borderColor = 'var(--glass-border)';
      const strong = tab.querySelector('strong');
      if (strong) strong.style.color = 'var(--color-cyan)';
      
      const intent = tab.getAttribute('data-intent') || 'math';
      runDemo(intent);
    });
  });

  runDemo('math');
}

function initPipelineVisualizer() {
  const pipeTabs = document.querySelectorAll('.pipeline-tab-btn');
  const strokeVal = document.getElementById('pipe-val-stroke');
  const contentVal = document.getElementById('pipe-val-content');
  const contextVal = document.getElementById('pipe-val-context');
  const intentVal = document.getElementById('pipe-val-intent');
  const actionsVal = document.getElementById('pipe-val-actions');

  const nodes = [
    document.getElementById('node-stroke'),
    document.getElementById('node-selection'),
    document.getElementById('node-context'),
    document.getElementById('node-intent'),
    document.getElementById('node-action')
  ];

  if (!pipeTabs.length || !strokeVal || !contentVal || !contextVal || !intentVal || !actionsVal) return;
  
  const strokeEl = strokeVal;
  const contentEl = contentVal;
  const contextEl = contextVal;
  const intentEl = intentVal;
  const actionsEl = actionsVal;

  const pipelines: Record<string, { stroke: string; content: string; context: string; intent: string; actions: string }> = {
    meeting: {
      stroke: 'Circle ⭕',
      content: '"Friday at 3 PM"',
      context: '📅 Future Event',
      intent: 'Schedule Calendar',
      actions: '<span style="background: rgba(0, 122, 255, 0.08); color: var(--color-cyan); padding: 2px 6px; border-radius: 4px; font-weight: 600;">Calendar</span><span style="background: rgba(0,0,0,0.04); color: var(--text-secondary); padding: 2px 6px; border-radius: 4px;">Reminder</span>'
    },
    math: {
      stroke: 'Circle ⭕',
      content: '"125 × 8"',
      context: '🧮 Math Equation',
      intent: 'Evaluate Formula',
      actions: '<span style="background: rgba(0, 122, 255, 0.08); color: var(--color-cyan); padding: 2px 6px; border-radius: 4px; font-weight: 600;">Solve</span><span style="background: rgba(0,0,0,0.04); color: var(--text-secondary); padding: 2px 6px; border-radius: 4px;">Graph</span>'
    },
    french: {
      stroke: 'Underline 〰',
      content: '"Bonjour..."',
      context: '🌍 French Text',
      intent: 'Translate Text',
      actions: '<span style="background: rgba(0, 122, 255, 0.08); color: var(--color-cyan); padding: 2px 6px; border-radius: 4px; font-weight: 600;">Translate</span><span style="background: rgba(0,0,0,0.04); color: var(--text-secondary); padding: 2px 6px; border-radius: 4px;">Explain</span>'
    },
    code: {
      stroke: 'Underline 〰',
      content: '"function add..."',
      context: '💻 Javascript Code',
      intent: 'Explain Code',
      actions: '<span style="background: rgba(0, 122, 255, 0.08); color: var(--color-cyan); padding: 2px 6px; border-radius: 4px; font-weight: 600;">Explain</span><span style="background: rgba(0,0,0,0.04); color: var(--text-secondary); padding: 2px 6px; border-radius: 4px;">Debug</span>'
    },
    product: {
      stroke: 'Connect ↔',
      content: 'Heritage + Vanguard',
      context: '⚖️ Product Pair',
      intent: 'Compare Features',
      actions: '<span style="background: rgba(0, 122, 255, 0.08); color: var(--color-cyan); padding: 2px 6px; border-radius: 4px; font-weight: 600;">Compare</span><span style="background: rgba(0,0,0,0.04); color: var(--text-secondary); padding: 2px 6px; border-radius: 4px;">Save</span>'
    }
  };

  let activeTimeouts: number[] = [];

  function runPipeline(key: string) {
    activeTimeouts.forEach(t => clearTimeout(t));
    activeTimeouts = [];
    
    nodes.forEach(n => {
      if (n) n.classList.remove('node-active');
    });

    const data = pipelines[key];
    
    strokeEl.textContent = data.stroke;
    contentEl.textContent = data.content;
    contextEl.textContent = data.context;
    intentEl.textContent = data.intent;
    actionsEl.innerHTML = data.actions;

    nodes.forEach((node, idx) => {
      if (!node) return;
      const t = window.setTimeout(() => {
        node.classList.add('node-active');
        AudioSynth.playPop();
      }, idx * 300);
      activeTimeouts.push(t);
    });
  }

  pipeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      pipeTabs.forEach(t => {
        t.classList.remove('active');
        (t as HTMLElement).style.background = 'transparent';
        (t as HTMLElement).style.borderColor = 'transparent';
        (t as HTMLElement).style.color = 'var(--text-secondary)';
      });
      tab.classList.add('active');
      (tab as HTMLElement).style.background = 'var(--bg-graphite)';
      (tab as HTMLElement).style.borderColor = 'var(--glass-border)';
      (tab as HTMLElement).style.color = 'var(--text-primary)';

      const pipelineKey = tab.getAttribute('data-pipeline') || 'meeting';
      runPipeline(pipelineKey);
    });
  });

  runPipeline('meeting');
}

// Execute Portal wire-up on document ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInteractivePortal);
} else {
  initInteractivePortal();
}

