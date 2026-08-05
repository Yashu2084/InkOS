import type { Point, CustomGestureTemplate } from '../sdk/types';
import { GestureEngine } from '../sdk/GestureEngine';
import { AudioSynth } from '../sdk/AudioSynth';

export class GestureComposer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isDrawing = false;
  private points: Point[] = [];
  private onSaveCallback: () => void;

  constructor(
    canvasElement: HTMLCanvasElement,
    clearBtn: HTMLButtonElement,
    saveBtn: HTMLButtonElement,
    nameInput: HTMLInputElement,
    actionSelect: HTMLSelectElement,
    onSave: () => void
  ) {
    this.canvas = canvasElement;
    const context = this.canvas.getContext('2d');
    if (!context) throw new Error('Could not get 2D rendering context');
    this.ctx = context;
    this.onSaveCallback = onSave;

    this.initCanvas();
    this.initEvents(clearBtn, saveBtn, nameInput, actionSelect);
  }

  private initCanvas(): void {
    // Setup crisp drawing resolution
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = '#007AFF'; // iOS blue
  }

  private initEvents(
    clearBtn: HTMLButtonElement,
    saveBtn: HTMLButtonElement,
    nameInput: HTMLInputElement,
    actionSelect: HTMLSelectElement
  ): void {
    const getCoordinates = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      const rect = this.canvas.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDraw = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      this.isDrawing = true;
      this.points = [];
      const coords = getCoordinates(e);
      this.points.push({ ...coords, t: Date.now() });

      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.beginPath();
      this.ctx.moveTo(coords.x, coords.y);
      AudioSynth.playRipple();
    };

    const draw = (e: MouseEvent | TouchEvent) => {
      if (!this.isDrawing) return;
      e.preventDefault();
      const coords = getCoordinates(e);
      this.points.push({ ...coords, t: Date.now() });

      this.ctx.lineTo(coords.x, coords.y);
      this.ctx.stroke();
    };

    const stopDraw = () => {
      this.isDrawing = false;
    };

    // Mouse handlers
    this.canvas.addEventListener('mousedown', startDraw);
    this.canvas.addEventListener('mousemove', draw);
    document.addEventListener('mouseup', stopDraw);

    // Touch handlers
    this.canvas.addEventListener('touchstart', startDraw, { passive: false });
    this.canvas.addEventListener('touchmove', draw, { passive: false });
    document.addEventListener('touchend', stopDraw);

    // Clear Pad
    clearBtn.addEventListener('click', () => {
      AudioSynth.playClick();
      this.clear();
    });

    // Save Template
    saveBtn.addEventListener('click', () => {
      const name = nameInput.value.trim().toLowerCase();
      const actionId = actionSelect.value;

      if (!name) {
        AudioSynth.playTone();
        alert('Please enter a gesture name.');
        return;
      }
      if (this.points.length < 5) {
        AudioSynth.playTone();
        alert('Please draw a longer gesture stroke first.');
        return;
      }

      AudioSynth.playPop();

      // Normalize and compile path templates
      const normalizedPoints = GestureEngine.normalizePath(this.points);

      const template: CustomGestureTemplate = {
        name,
        normalizedPoints,
        actionId
      };

      try {
        const storedStr = localStorage.getItem('inkos_custom_gestures');
        const list: CustomGestureTemplate[] = storedStr ? JSON.parse(storedStr) : [];
        
        // Remove duplicate by name if exists
        const filteredList = list.filter(item => item.name.toLowerCase() !== name);
        filteredList.push(template);

        localStorage.setItem('inkos_custom_gestures', JSON.stringify(filteredList));
        
        // Clear input and pad
        nameInput.value = '';
        this.clear();
        this.onSaveCallback();
      } catch (e) {
        console.error('Failed to save template', e);
        AudioSynth.playTone();
      }
    });
  }

  public clear(): void {
    this.points = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
