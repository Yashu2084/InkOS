import { AudioSynth } from '../sdk/AudioSynth';

export class ControlCenter {
  private orb: HTMLElement;
  private panel: HTMLElement;
  private isOpen = false;

  constructor(
    orbElement: HTMLElement,
    panelElement: HTMLElement,
    onActionClick: (actionId: string) => void
  ) {
    this.orb = orbElement;
    this.panel = panelElement;

    this.initEvents(onActionClick);
  }

  private initEvents(onActionClick: (actionId: string) => void): void {
    // Toggle Control Center panel when clicking the glass orb
    this.orb.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });

    // Close panel when clicking anywhere else on the document
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (this.isOpen && !this.panel.contains(target) && !this.orb.contains(target)) {
        this.close();
      }
    });

    // Wire clicks on items inside the Control Center panel
    const items = this.panel.querySelectorAll('.control-item-row');
    items.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        AudioSynth.playPop();
        
        const actionId = item.getAttribute('data-action-id') || '';
        onActionClick(actionId);
        
        this.close();
      });
    });
  }

  public toggle(): void {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  public open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    
    // Play Pop sound
    AudioSynth.playPop();
    
    this.panel.style.display = 'flex';
    // Add micro-delay to let display block compile for transitions
    setTimeout(() => {
      this.panel.classList.add('open');
    }, 10);
  }

  public close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    
    // Play Click sound
    AudioSynth.playClick();
    
    this.panel.classList.remove('open');
    
    // Hide display after transition completes (300ms)
    setTimeout(() => {
      if (!this.isOpen) {
        this.panel.style.display = 'none';
      }
    }, 300);
  }
}
