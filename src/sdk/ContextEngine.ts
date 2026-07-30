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
      const type = (bestTarget.getAttribute('data-inkos-type') || 'text') as ContextType;
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
