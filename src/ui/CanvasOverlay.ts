import type { Point } from '../sdk/types';
import { AudioSynth } from '../sdk/AudioSynth';

export class CanvasOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private points: Point[] = [];
  private currentStroke: Point[] = [];
  
  // Custom pointer element
  private inkPointerEl: HTMLElement | null = null;
  
  // Callback when a complete gesture stroke is finished
  private onGestureCompleteCallback: (points: Point[]) => void;
  
  // Timeout for detecting multi-stroke gestures (like crosses or question marks)
  private strokeEndTimeout: number | null = null;
  private readonly MULTI_STROKE_DELAY = 300; // ms to wait for another stroke

  // Fade parameters
  private fadeInterval: number | null = null;
  private fadeAlpha = 1.0;
  private fadePoints: Point[] = [];

  // Config parameters
  private inkColor = '#00F1FC'; // Electric Cyan

  constructor(canvasElement: HTMLCanvasElement, onGestureComplete: (points: Point[]) => void) {
    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context from canvas');
    this.ctx = context;
    
    this.onGestureCompleteCallback = onGestureComplete;
    this.inkPointerEl = document.getElementById('ink-pointer');
    
    this.initEvents();
    this.resizeCanvas();

    // Listen to resize events
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  public resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.clearCanvas();
  }

  public clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.points = [];
    this.currentStroke = [];
  }

  public drawPoints(pts: Point[], alpha = 1.0): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawPointsPath(pts, this.inkColor, 3.5, alpha);
  }


  private initEvents(): void {
    // Pointer movements for drawing and custom cursor positioning
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    
    // Custom cursor visibility triggers
    this.canvas.addEventListener('pointerenter', (e) => this.handlePointerEnter(e));
    this.canvas.addEventListener('pointerleave', (e) => this.handlePointerLeave(e));
  }

  private handlePointerEnter(e: PointerEvent): void {
    this.canvas.classList.add('ink-cursor-active');
    if (this.inkPointerEl) {
      this.inkPointerEl.style.display = 'block';
      this.updateCursorPosition(e);
    }
  }

  private handlePointerLeave(e: PointerEvent): void {
    if (!this.isDrawing) {
      this.canvas.classList.remove('ink-cursor-active');
      if (this.inkPointerEl) {
        this.inkPointerEl.style.display = 'none';
      }
    }
    this.handlePointerUp(e);
  }

  private updateCursorPosition(e: PointerEvent): void {
    if (this.inkPointerEl) {
      this.inkPointerEl.style.left = `${e.clientX}px`;
      this.inkPointerEl.style.top = `${e.clientY}px`;
    }
  }

  private handlePointerDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') {
      e.preventDefault();
    }

    this.isDrawing = true;
    this.canvas.setPointerCapture(e.pointerId);

    // Play synthesized warm Activation Ripple sound
    AudioSynth.playRipple();

    // Cancel any active timeouts or fades
    if (this.strokeEndTimeout) {
      clearTimeout(this.strokeEndTimeout);
      this.strokeEndTimeout = null;
    }
    this.stopFade();

    const pt = this.getPointFromEvent(e);
    this.currentStroke = [pt];
    this.points.push(pt);
    
    this.drawStartPoint(pt);
    this.updateCursorPosition(e);
  }

  private handlePointerMove(e: PointerEvent): void {
    this.updateCursorPosition(e);

    if (!this.isDrawing) return;
    
    if (e.pointerType === 'touch') {
      e.preventDefault();
    }

    const pt = this.getPointFromEvent(e);
    
    // Check points density
    const lastPt = this.currentStroke[this.currentStroke.length - 1];
    if (lastPt) {
      const dist = Math.sqrt(Math.pow(pt.x - lastPt.x, 2) + Math.pow(pt.y - lastPt.y, 2));
      if (dist > 1.5) {
        this.currentStroke.push(pt);
        this.points.push(pt);
        this.drawSmoothStroke();
      }
    }
  }

  private handlePointerUp(e: PointerEvent): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;
    
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}

    if (this.currentStroke.length > 2) {
      // Set timeout for multi-stroke support (e.g. cross or question mark dotting)
      this.strokeEndTimeout = window.setTimeout(() => {
        const gesturePoints = [...this.points];
        
        // Play action complete audio pop/click
        AudioSynth.playClick();
        
        // Start fading drawing path in background
        this.startFade([...gesturePoints]);
        
        // Callback
        this.onGestureCompleteCallback(gesturePoints);
        
        this.points = [];
        this.currentStroke = [];
      }, this.MULTI_STROKE_DELAY);
    }
  }

  private getPointFromEvent(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: Date.now()
    };
  }

  private drawStartPoint(pt: Point): void {
    this.ctx.beginPath();
    this.ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
    this.ctx.fillStyle = this.inkColor;
    this.ctx.fill();
  }

  private drawSmoothStroke(): void {
    if (this.currentStroke.length < 2) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawPointsPath(this.points, this.inkColor, 3.5);
  }

  private drawPointsPath(pts: Point[], color: string, baseWidth: number, alpha = 1.0): void {
    if (pts.length < 2) return;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = alpha;
    
    // Glowing cyan line overlay shadow
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 6;

    for (let i = 1; i < pts.length; i++) {
      const p1 = pts[i - 1];
      const p2 = pts[i];
      
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const t2 = p2.t ?? Date.now();
      const t1 = p1.t ?? (t2 - 10);
      const time = Math.max(1, t2 - t1);
      const speed = dist / time;

      // Slower swipe = thicker ink, faster swipe = thinner tapered ink
      const segmentWidth = Math.max(1.8, Math.min(5.5, baseWidth * 1.5 - speed * 1.6));

      this.ctx.lineWidth = segmentWidth;
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);

      if (i < pts.length - 1) {
        const xc = (p2.x + pts[i + 1].x) / 2;
        const yc = (p2.y + pts[i + 1].y) / 2;
        this.ctx.quadraticCurveTo(p2.x, p2.y, xc, yc);
      } else {
        this.ctx.lineTo(p2.x, p2.y);
      }
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  // --- FADE OUT ANIMATION ---

  private startFade(pointsToFade: Point[]): void {
    this.stopFade();
    this.fadePoints = pointsToFade;
    this.fadeAlpha = 1.0;

    const fadeStep = () => {
      this.fadeAlpha -= 0.08;

      if (this.fadeAlpha <= 0) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.stopFade();
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawPointsPath(this.fadePoints, this.inkColor, 3.5, this.fadeAlpha);
        this.fadeInterval = requestAnimationFrame(fadeStep);
      }
    };

    this.fadeInterval = requestAnimationFrame(fadeStep);
  }

  private stopFade(): void {
    if (this.fadeInterval) {
      cancelAnimationFrame(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
}
