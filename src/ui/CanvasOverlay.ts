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
  private readonly MULTI_STROKE_DELAY = 350; // ms to wait for another stroke

  // Fade parameters
  private fadeInterval: number | null = null;
  private fadeAlpha = 1.0;
  private fadePoints: Point[] = [];

  // Config parameters
  private inkColor = '#00F1FC'; // Electric Cyan accent color

  constructor(canvasElement: HTMLCanvasElement, onGestureComplete: (points: Point[]) => void) {
    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d', { desynchronized: true }); // Request low input latency context
    if (!context) throw new Error('Could not get 2D context from canvas');
    this.ctx = context;
    
    this.onGestureCompleteCallback = onGestureComplete;
    this.inkPointerEl = document.getElementById('ink-pointer');
    
    this.initEvents();
    this.resizeCanvas();

    // Listen to resize events
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  /**
   * Resizes canvas supporting High-DPI / Retina screens.
   */
  public resizeCanvas(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    
    this.ctx.scale(dpr, dpr);
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
      if (dist > 1.2) {
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
        
        // Callback to let the application process intent & determine the Action Pill position
        this.onGestureCompleteCallback(gesturePoints);
      }, this.MULTI_STROKE_DELAY);
    }
  }

  private getPointFromEvent(e: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    // Normalize pressure (default to 0.5 if not supported/zero)
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      t: Date.now(),
      pressure
    };
  }

  private drawStartPoint(pt: Point): void {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
    this.ctx.fillStyle = this.inkColor;
    this.ctx.shadowColor = this.inkColor;
    this.ctx.shadowBlur = 6;
    this.ctx.fill();
    this.ctx.restore();
  }

  private drawSmoothStroke(): void {
    if (this.currentStroke.length < 2) return;
    
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawPointsPath(this.points, this.inkColor, 3.5);
  }

  /**
   * Draws a beautiful calligraphic line using speed-based width adjustments,
   * physical stylus pressure simulation, and smooth tapering at the start and end of strokes.
   */
  private drawPointsPath(pts: Point[], color: string, baseWidth: number, alpha = 1.0): void {
    if (pts.length < 2) return;

    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.globalAlpha = alpha * 0.85; // Slightly translucent liquid feel
    
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 5;

    const totalPoints = pts.length;

    for (let i = 1; i < totalPoints; i++) {
      const p1 = pts[i - 1];
      const p2 = pts[i];
      
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      const t2 = p2.t ?? Date.now();
      const t1 = p1.t ?? (t2 - 10);
      const time = Math.max(1, t2 - t1);
      const speed = dist / time;

      // Base width calculations combining velocity (slower drawing = thicker lines)
      let segmentWidth = Math.max(1.8, Math.min(6.5, baseWidth * 1.5 - speed * 1.6));

      // Incorporate device pressure sensitivity if available
      const pressureVal = p2.pressure !== undefined ? p2.pressure : 0.5;
      segmentWidth = segmentWidth * (0.6 + pressureVal * 0.8);

      // Natural stroke tapering (first 6 and last 6 points fade out to 0 width)
      const taperPoints = 6;
      if (i < taperPoints) {
        segmentWidth *= (i / taperPoints);
      } else if (totalPoints - i < taperPoints) {
        segmentWidth *= ((totalPoints - i) / taperPoints);
      }

      this.ctx.lineWidth = Math.max(0.5, segmentWidth);
      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);

      if (i < totalPoints - 1) {
        // Smooth Bezier interpolation
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

  /**
   * Animates/morphs the complete drawing stroke toward the center of the Action Pill position.
   */
  public animateMorph(targetX: number, targetY: number, callback: () => void): void {
    this.stopFade();
    
    const pointsToAnimate = [...this.points];
    this.points = [];
    this.currentStroke = [];
    
    if (pointsToAnimate.length === 0) {
      callback();
      return;
    }

    const startTime = performance.now();
    const duration = 280; // Fast and responsive (280ms)
    
    const animStep = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(1, elapsed / duration);
      
      // Fast start and deceleration pull curve (ease-out cubic)
      const ease = 1 - Math.pow(1 - pct, 3);
      
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      if (pct >= 1) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        callback();
      } else {
        // Move all coordinates in the path toward the target coordinates
        const animatedPoints = pointsToAnimate.map(p => ({
          x: p.x + (targetX - p.x) * ease,
          y: p.y + (targetY - p.y) * ease,
          t: p.t,
          pressure: p.pressure
        }));
        
        // Draw the shrinking stroke path with fading opacity
        this.drawPointsPath(animatedPoints, this.inkColor, 3.5, 1.0 - pct);
        this.fadeInterval = requestAnimationFrame(animStep);
      }
    };
    
    this.fadeInterval = requestAnimationFrame(animStep);
  }

  // --- STANDARD BACKGROUND FADE OUT FALLBACK ---

  public startFade(pointsToFade: Point[] = [...this.points]): void {
    this.stopFade();
    this.fadePoints = pointsToFade;
    this.fadeAlpha = 1.0;
    this.points = [];
    this.currentStroke = [];

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

  public stopFade(): void {
    if (this.fadeInterval) {
      cancelAnimationFrame(this.fadeInterval);
      this.fadeInterval = null;
    }
  }
}
