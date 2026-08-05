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
    onSelect: (intent: Intent) => void
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

    // Adjust position so menu doesn't overflow container bounds
    this.adjustElementPosition(menu, position);
  }

  public hide(): void {
    if (this.menuElement) {
      this.menuElement.remove();
      this.menuElement = null;
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
  private adjustElementPosition(el: HTMLElement, pos: { x: number; y: number }): void {
    const parentRect = this.container.getBoundingClientRect();
    const elWidth = el.offsetWidth || 250;
    const elHeight = el.offsetHeight || 180;

    let left = pos.x + 10;
    let top = pos.y + 10;

    // Check right boundary overflow
    if (left + elWidth > parentRect.width) {
      left = pos.x - elWidth - 10;
    }
    if (left < 0) {
      left = 10;
    }

    // Check bottom boundary overflow
    if (top + elHeight > parentRect.height) {
      top = pos.y - elHeight - 10;
    }
    if (top < 0) {
      top = 10;
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }
}
