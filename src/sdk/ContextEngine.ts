import type { BoundingBox, ContextElement, ContextType } from './types';

export class ContextEngine {
  /**
   * Identifies what element exists under the gesture's bounding box.
   * Compares the gesture's client bounding box with client bounding boxes of target elements.
   * 
   * @param gestureBounds Bounding box of the gesture in client (viewport) coordinates
   * @param containerElement Optional parent container of the mock screen to scope selection
   */
  public static detectContext(gestureBounds: BoundingBox, containerElement: HTMLElement = document.body): ContextElement {
    // Find all elements marked as InkOS targets
    const targets = Array.from(containerElement.querySelectorAll('.inkos-target')) as HTMLElement[];
    
    let bestTarget: HTMLElement | null = null;
    let highestOverlapScore = 0;
    
    for (const target of targets) {
      const rect = target.getBoundingClientRect();
      const score = this.calculateOverlapScore(gestureBounds, rect, target);
      
      if (score > highestOverlapScore) {
        highestOverlapScore = score;
        bestTarget = target;
      }
    }

    if (bestTarget && highestOverlapScore > 0.05) {
      let type = (bestTarget.getAttribute('data-inkos-type') || 'text') as ContextType;
      const content = bestTarget.getAttribute('data-inkos-content') || bestTarget.innerText || '';
      
      const targetRect = bestTarget.getBoundingClientRect();
      
      // Look for custom metadata stored on the element
      let metadata: any = {};
      try {
        const metaStr = bestTarget.getAttribute('data-inkos-metadata');
        if (metaStr) {
          metadata = JSON.parse(metaStr);
        }
      } catch (e) {
        console.error('Failed to parse metadata for element', e);
      }

      // Semantic content type detection and context inference
      if (type === 'text') {
        const textContent = content.trim();
        
        // 1. Math Equation check
        const cleanText = textContent.replace(/\s+/g, '');
        const hasNumbers = /[\d]/.test(cleanText);
        const hasOperators = /[\+\-\*\/×÷]/.test(cleanText);
        const isMathChars = /^[\d\s+\-*/×÷()=.]+$/.test(cleanText);
        if (isMathChars && hasNumbers && hasOperators) {
          type = 'equation';
        }
        // 2. Email check
        else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(textContent)) {
          type = 'email';
        }
        // 3. Link check
        else if (/^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/\S*)?$/.test(textContent)) {
          type = 'link';
        }
        // 4. Phone check
        else if (/^\+?[\d\s\-()]{7,15}$/.test(textContent) && /[\d]/.test(textContent)) {
          type = 'phone';
        }
        // 5. Date/Time/Event check
        else {
          const dateRegex = /(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow|january|february|march|april|may|june|july|august|september|october|november|december|\d{1,2}\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|\d{1,2}\/\d{1,2})/i;
          const timeRegex = /(\d{1,2}(:\d{2})?\s*(pm|am|clock))/i;
          
          if (dateRegex.test(textContent) || timeRegex.test(textContent)) {
            type = 'event';
            metadata.isEvent = true;
            metadata.dateMatch = textContent.match(dateRegex)?.[0];
            metadata.timeMatch = textContent.match(timeRegex)?.[0];
          }
        }
      } else if (type === 'image') {
        // Product card check
        if (bestTarget.classList.contains('sim-product-card') || bestTarget.id.includes('prod') || content.toLowerCase().includes('watch')) {
          type = 'product';
        }
      }

      return {
        id: bestTarget.id || `ctx_${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        bounds: {
          x: targetRect.left,
          y: targetRect.top,
          width: targetRect.width,
          height: targetRect.height
        },
        element: bestTarget,
        metadata
      };
    }

    // Default to empty context if nothing intersected significantly
    return {
      id: 'empty_ctx',
      type: 'empty',
      content: '',
      bounds: gestureBounds,
      element: containerElement
    };
  }

  /**
   * Calculates how much a target element overlaps with the gesture bounding box.
   * Tailors scoring depending on element type and aspect ratio.
   */
  private static calculateOverlapScore(gesture: BoundingBox, target: DOMRect, element: HTMLElement): number {
    const xOverlap = Math.max(0, Math.min(gesture.x + gesture.width, target.right) - Math.max(gesture.x, target.left));
    const yOverlap = Math.max(0, Math.min(gesture.y + gesture.height, target.bottom) - Math.max(gesture.y, target.top));
    const overlapArea = xOverlap * yOverlap;
    
    if (overlapArea <= 0) return 0;

    const gestureArea = gesture.width * gesture.height;
    const targetArea = target.width * target.height;

    // Union area: A + B - Intersection
    const unionArea = gestureArea + targetArea - overlapArea;
    const jaccardIndex = unionArea > 0 ? overlapArea / unionArea : 0;

    // If gesture is mostly inside or covering the target
    const coverageOfTarget = overlapArea / targetArea;
    const coverageOfGesture = overlapArea / gestureArea;

    // Context types: math cards, images, code blocks, etc.
    const targetType = element.getAttribute('data-inkos-type') || 'text';

    // Heuristics:
    // 1. Math/Code blocks/Images: Circle/Lasso gestures tend to enclose them. 
    //    We score highly if the gesture mostly covers the element.
    if (targetType === 'image' || targetType === 'math' || targetType === 'code' || targetType === 'table') {
      // If gesture surrounds the element's center, boost score
      const gestureCenter = { x: gesture.x + gesture.width / 2, y: gesture.y + gesture.height / 2 };
      const targetCenter = { x: target.left + target.width / 2, y: target.top + target.height / 2 };
      const centerDist = Math.sqrt(Math.pow(gestureCenter.x - targetCenter.x, 2) + Math.pow(gestureCenter.y - targetCenter.y, 2));
      const maxCenterDist = Math.max(gesture.width, gesture.height);
      const centerScore = Math.max(0, 1 - (centerDist / (maxCenterDist + 1)));

      return (coverageOfTarget * 0.4) + (jaccardIndex * 0.3) + (centerScore * 0.3);
    }

    // 2. Text elements: Can be underlined or lassoed.
    //    Underline is thin but horizontal. Jaccard index will be low (since target text block is thick, or line is thin).
    //    We reward horizontal overlap (xOverlap / targetWidth) and check if vertical overlap intersects the text line.
    if (targetType === 'text') {
      const horizontalCoverage = xOverlap / target.width;
      // If the gesture is thin vertically (like an underline), we look at horizontal coverage.
      if (gesture.height < 50 && gesture.width > 80) {
        return horizontalCoverage * 0.9;
      }
      return (coverageOfTarget * 0.5) + (coverageOfGesture * 0.5);
    }

    return jaccardIndex;
  }
}
