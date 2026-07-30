import type { Intent } from '../sdk/types';

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
    menu.className = 'floating-action-menu';
    
    // Header indicating the gesture type matched
    const matchedGesture = intents[0]?.gesture || 'unknown';
    const header = document.createElement('div');
    header.className = 'menu-header';
    header.innerHTML = `
      <span>Gesture matched: <strong>${matchedGesture}</strong></span>
      <span>${intents.length} actions</span>
    `;
    menu.appendChild(header);

    // List out matched intents
    intents.forEach((intent, idx) => {
      const btn = document.createElement('button');
      btn.className = 'menu-item-btn';
      
      // Highlight the first (top confidence) recommendation
      if (idx === 0) {
        btn.classList.add('top-recommendation');
      }

      btn.innerHTML = `
        <span class="btn-icon">${intent.icon}</span>
        <div class="btn-label-box">
          <strong>${intent.label}</strong>
          <span class="btn-desc">${intent.description}</span>
        </div>
      `;

      btn.addEventListener('click', () => {
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
   * Displays loading micro-animation when an action executes.
   */
  public showLoading(position: { x: number; y: number }): void {
    this.hide();
    
    const loader = document.createElement('div');
    loader.className = 'floating-action-menu';
    loader.style.width = '120px';
    loader.innerHTML = `
      <div class="loading-box">
        <div class="loader-dot"></div>
        <div class="loader-dot"></div>
        <div class="loader-dot"></div>
      </div>
    `;
    
    this.container.appendChild(loader);
    this.menuElement = loader;
    this.adjustElementPosition(loader, position);
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
    result.className = 'action-result-overlay';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'result-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => {
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

    // Bind special action buttons inside content (e.g. OCR copies)
    const ocrCopyBtn = result.querySelector('#ocr-copy-btn-action');
    if (ocrCopyBtn) {
      ocrCopyBtn.addEventListener('click', () => {
        const text = ocrCopyBtn.previousElementSibling?.textContent || '';
        navigator.clipboard.writeText(text.replace(/"/g, ''));
        ocrCopyBtn.textContent = 'Copied to Clipboard! ✓';
        ocrCopyBtn.classList.add('bg-success');
      });
    }

    const csvCopyBtn = result.querySelector('#te-copy-btn');
    if (csvCopyBtn) {
      csvCopyBtn.addEventListener('click', () => {
        const text = result.querySelector('.te-csv')?.textContent || '';
        navigator.clipboard.writeText(text);
        csvCopyBtn.textContent = 'CSV Copied! ✓';
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
   * Safely calculates positioning within container boundaries.
   */
  private adjustElementPosition(el: HTMLElement, pos: { x: number; y: number }): void {
    const parentRect = this.container.getBoundingClientRect();
    const elWidth = el.offsetWidth || 250;
    const elHeight = el.offsetHeight || 180;

    // Default: position next to coordinate
    let left = pos.x + 10;
    let top = pos.y + 10;

    // Check right boundary overflow
    if (left + elWidth > parentRect.width) {
      left = pos.x - elWidth - 10;
    }
    // Check left boundary overflow
    if (left < 0) {
      left = 10;
    }

    // Check bottom boundary overflow
    if (top + elHeight > parentRect.height) {
      top = pos.y - elHeight - 10;
    }
    // Check top boundary overflow
    if (top < 0) {
      top = 10;
    }

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }
}
