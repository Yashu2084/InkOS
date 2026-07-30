import type { Point } from '../sdk/types';

export class CanvasOverlay {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private points: Point[] = [];
  private currentStroke: Point[] = [];
  
  // Callback when a complete gesture stroke is finished
  private onGestureCompleteCallback: (points: Point[]) => void;
  
  // Timeout for detecting multi-stroke gestures (like crosses or question marks)
  private strokeEndTimeout: number | null = null;
  private readonly MULTI_STROKE_DELAY = 300; // ms to wait for another stroke

  // Fade parameters
  private fadeInterval: number | null = null;
  private fadeAlpha = 1.0;
  private fadePoints: Point[] = [];

  constructor(canvasElement: HTMLCanvasElement, onGestureComplete: (points: Point[]) => void) {
    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D context from canvas');
    this.ctx = context;
    
    this.onGestureCompleteCallback = onGestureComplete;
    this.initEvents();
    this.resizeCanvas();

    // Listen to resize events
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  public resizeCanvas(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      this.canvas.width = rect.width;
      // Offset for device-header-bar height (30px)
      this.canvas.height = rect.height - 30;
      this.clearCanvas();
    }
  }

  public clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.points = [];
    this.currentStroke = [];
  }

  private initEvents(): void {
    // We use pointer events to support both touch and mouse
    this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
    this.canvas.addEventListener('pointerleave', (e) => this.handlePointerUp(e));
  }

  private handlePointerDown(e: PointerEvent): void {
    // Prevent default touch gestures (scrolling) while drawing
    if (e.pointerType === 'touch') {
      e.preventDefault();
    }

    this.isDrawing = true;
    this.canvas.setPointerCapture(e.pointerId);

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
  }

  private handlePointerMove(e: PointerEvent): void {
    if (!this.isDrawing) return;
    
    if (e.pointerType === 'touch') {
      e.preventDefault();
    }

    const pt = this.getPointFromEvent(e);
    
    // Add point if distance is sufficient to avoid redundant points
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
      // Set timeout for multi-stroke support (e.g. cross or dotting question mark)
      this.strokeEndTimeout = window.setTimeout(() => {
        const gesturePoints = [...this.points];
        
        // Start ink fade out animation
        this.startFade([...gesturePoints]);
        
        // Trigger completion callback
        this.onGestureCompleteCallback(gesturePoints);
        
        // Reset points
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
    this.ctx.fillStyle = '#8B5CF6';
    this.ctx.fill();
  }

  private drawSmoothStroke(): void {
    if (this.currentStroke.length < 2) return;
    
    // Keep canvas drawing synchronized with points
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // If there were previous strokes, draw them too
    // In our simplified version we just redraw all current session points
    this.drawPointsPath(this.points, '#8B5CF6', 3.5);
  }

  private drawPointsPath(pts: Point[], color: string, width: number, alpha = 1.0): void {
    if (pts.length < 2) return;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = alpha;
    
    // Neon glow effect
    this.ctx.shadowColor = '#8B5CF6';
    this.ctx.shadowBlur = 6;

    this.ctx.beginPath();
    this.ctx.moveTo(pts[0].x, pts[0].y);

    // Quadratic curve smoothing
    for (let i = 1; i < pts.length - 1; i++) {
      const xc = (pts[i].x + pts[i + 1].x) / 2;
      const yc = (pts[i].y + pts[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
    }

    // Connect to final point
    this.ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  // --- FADE OUT ANIMATION ---

  private startFade(pointsToFade: Point[]): void {
    this.stopFade();
    this.fadePoints = pointsToFade;
    this.fadeAlpha = 1.0;

    const fadeStep = () => {
      this.fadeAlpha -= 0.08; // Reduce opacity each frame

      if (this.fadeAlpha <= 0) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.stopFade();
      } else {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawPointsPath(this.fadePoints, '#8B5CF6', 3.5, this.fadeAlpha);
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
