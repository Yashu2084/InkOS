import type { Intent } from '../sdk/types';
import { AudioSynth } from '../sdk/AudioSynth';

export class ActionMenu {
  private container: HTMLElement;
  private menuElement: HTMLDivElement | null = null;
  private resultElement: HTMLDivElement | null = null;

  constructor(containerElement: HTMLElement) {
    this.container = containerElement;
  }

  /**
   * Renders the floating glassmorphic intent suggestion menu.
   */
  public show(
    intents: Intent[],
    position: { x: number; y: number },
    onSelect: (intent: Intent) => void,
    targetBounds?: { x: number; y: number; width: number; height: number }
  ): void {
    this.hide();
    this.hideResult();

    const menu = document.createElement('div');
    menu.className = 'vision-action-pill';
    
    // Header indicating the gesture type matched
    const matchedGesture = intents[0]?.gesture || 'unknown';
    const header = document.createElement('div');
    header.className = 'pill-meta-header';
    header.innerHTML = `
      <span>Matched: <strong>${matchedGesture}</strong></span>
      <span>${intents.length} actions</span>
    `;
    menu.appendChild(header);

    // List out matched intents
    intents.forEach((intent, idx) => {
      const btn = document.createElement('button');
      btn.className = 'pill-item-btn';
      
      // Highlight the top recommendation in Cyan glass
      if (idx === 0) {
        btn.classList.add('cyan-active');
      }

      btn.innerHTML = `
        <span class="pill-icon">${intent.icon}</span>
        <div class="pill-label-wrapper">
          <strong>${intent.label}</strong>
          <span class="pill-desc">${intent.description}</span>
        </div>
      `;

      btn.addEventListener('click', () => {
        // Play click sound on selection
        AudioSynth.playPop();
        onSelect(intent);
      });

      menu.appendChild(btn);
    });

    this.container.appendChild(menu);
    this.menuElement = menu;

    // Adjust position so menu doesn't overflow container bounds or cover the element
    this.adjustElementPosition(menu, position, targetBounds);

    // Bind Keyboard focus navigation
    const buttons = Array.from(menu.querySelectorAll('.pill-item-btn')) as HTMLButtonElement[];
    if (buttons.length > 0) {
      let activeIndex = 0;
      
      // Highlight the cyan-active button initially if present
      const cyanActiveIdx = buttons.findIndex(btn => btn.classList.contains('cyan-active'));
      if (cyanActiveIdx !== -1) {
        activeIndex = cyanActiveIdx;
      }
      
      // Short delay focusing to prevent Enter key repeating from activation shortcut
      setTimeout(() => {
        if (buttons[activeIndex]) {
          buttons[activeIndex].focus();
        }
      }, 50);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) {
          e.preventDefault();
          activeIndex = (activeIndex + 1) % buttons.length;
          buttons[activeIndex].focus();
        } else if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) {
          e.preventDefault();
          activeIndex = (activeIndex - 1 + buttons.length) % buttons.length;
          buttons[activeIndex].focus();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          this.hide();
          window.dispatchEvent(new CustomEvent('inkos-cancel'));
        }
      };

      menu.addEventListener('keydown', handleKeyDown);
    }
  }

  public hide(): void {
    if (this.menuElement) {
      const el = this.menuElement;
      this.menuElement = null; // Detach reference immediately
      
      el.classList.add('fade-out');
      el.addEventListener('animationend', () => {
        el.remove();
      }, { once: true });
      
      // Fallback
      setTimeout(() => {
        if (el.parentNode) el.remove();
      }, 250);
    }
  }

  /**
   * Displays loading micro-animation steps when an action executes.
   */
  public async showLoading(position: { x: number; y: number }, steps: string[] = [
    'Understanding Context...',
    'Recognizing Gesture...',
    'Analyzing Content...',
    'Executing Action...'
  ]): Promise<void> {
    this.hide();
    
    const loader = document.createElement('div');
    loader.className = 'vision-action-pill';
    loader.style.width = '240px';
    loader.style.padding = '8px';
    
    const stepsContainer = document.createElement('div');
    stepsContainer.style.display = 'flex';
    stepsContainer.style.flexDirection = 'column';
    stepsContainer.style.gap = '4px';
    loader.appendChild(stepsContainer);
    
    this.container.appendChild(loader);
    this.menuElement = loader;
    this.adjustElementPosition(loader, position);

    // Render and resolve processing phases sequentially
    for (let i = 0; i < steps.length; i++) {
      if (!this.menuElement) break;
      
      const stepRow = document.createElement('div');
      stepRow.className = 'processing-step-row';
      stepRow.innerHTML = `
        <div class="processing-step-spinner"></div>
        <span>${steps[i]}</span>
      `;
      stepsContainer.appendChild(stepRow);
      
      // Adaptive time progression
      await new Promise(resolve => setTimeout(resolve, 140));
      
      const spinner = stepRow.querySelector('.processing-step-spinner');
      if (spinner) {
        spinner.className = 'processing-step-check';
        spinner.innerHTML = '✓';
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 80));
  }

  /**
   * Shows action output overlay.
   */
  public showResult(
    htmlContent: string,
    position: { x: number; y: number },
    onClose: () => void
  ): void {
    this.hideResult();
    this.hide();

    const result = document.createElement('div');
    result.className = 'glass-result-overlay';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'result-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
      // Play pop sound when closing result
      AudioSynth.playClick();
      this.hideResult();
      onClose();
    });

    const contentBox = document.createElement('div');
    contentBox.className = 'result-content-body';
    contentBox.innerHTML = htmlContent;

    result.appendChild(closeBtn);
    result.appendChild(contentBox);
    this.container.appendChild(result);
    this.resultElement = result;

    this.adjustElementPosition(result, position);

    // Bind special actions if present inside content
    const ocrCopyBtn = result.querySelector('#ocr-copy-btn-action') as HTMLElement;
    if (ocrCopyBtn) {
      ocrCopyBtn.addEventListener('click', () => {
        AudioSynth.playPop();
        const text = ocrCopyBtn.previousElementSibling?.textContent || '';
        navigator.clipboard.writeText(text.replace(/"/g, ''));
        ocrCopyBtn.textContent = 'Copied to Clipboard! ✓';
        ocrCopyBtn.style.background = '#30D158';
      });
    }

    const csvCopyBtn = result.querySelector('#te-copy-btn') as HTMLElement;
    if (csvCopyBtn) {
      csvCopyBtn.addEventListener('click', () => {
        AudioSynth.playPop();
        const text = result.querySelector('.te-csv')?.textContent || '';
        navigator.clipboard.writeText(text);
        csvCopyBtn.textContent = 'CSV Copied! ✓';
        csvCopyBtn.style.background = '#30D158';
      });
    }
  }

  public hideResult(): void {
    if (this.resultElement) {
      this.resultElement.remove();
      this.resultElement = null;
    }
  }

  /**
   * Calculates positioning within container boundaries.
   */
  private adjustElementPosition(
    el: HTMLElement, 
    pos: { x: number; y: number },
    targetBounds?: { x: number; y: number; width: number; height: number }
  ): void {
    const parentRect = this.container.getBoundingClientRect();
    const elWidth = el.offsetWidth || 250;
    const elHeight = el.offsetHeight || 180;

    let left = pos.x;
    let top = pos.y;

    if (targetBounds) {
      // Place to the right of the target bounding box with a 12px offset
      left = targetBounds.x + targetBounds.width + 12;
      top = targetBounds.y;

      // Check right overflow: if placing on right overflows, place on left of target
      if (left + elWidth > parentRect.width) {
        left = targetBounds.x - elWidth - 12;
      }
      // If left also overflows or is negative, place below the target
      if (left < 0) {
        left = targetBounds.x + (targetBounds.width - elWidth) / 2;
        top = targetBounds.y + targetBounds.height + 12;
      }
      // If bottom overflows, place above the target
      if (top + elHeight > parentRect.height) {
        top = targetBounds.y - elHeight - 12;
      }
    } else {
      left = pos.x + 10;
      top = pos.y + 10;
      
      if (left + elWidth > parentRect.width) {
        left = pos.x - elWidth - 10;
      }
      if (top + elHeight > parentRect.height) {
        top = pos.y - elHeight - 10;
      }
    }

    // Guard coordinates inside screen boundaries with a 12px safety padding
    const padding = 12;
    left = Math.max(padding, Math.min(parentRect.width - elWidth - padding, left));
    top = Math.max(padding, Math.min(parentRect.height - elHeight - padding, top));

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }
}
