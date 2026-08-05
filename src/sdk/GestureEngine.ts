import type { Point, Gesture, GestureType, BoundingBox, CustomGestureTemplate } from './types';

export class GestureEngine {
  /**
   * Recognizes a gesture from a sequence of points.
   */
  public static recognize(points: Point[]): Gesture {
    if (points.length < 5) {
      return {
        type: 'unknown',
        confidence: 0,
        bounds: this.getBoundingBox(points),
        points
      };
    }

    // 0. Check custom template registry first
    const customMatch = this.recognizeCustom(points);
    if (customMatch) {
      return customMatch;
    }

    const bounds = this.getBoundingBox(points);
    const centroid = this.getCentroid(points);
    const pathLength = this.getPathLength(points);
    const startEndDist = this.getDistance(points[0], points[points.length - 1]);
    const diagonal = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height);

    // Heuristics calculations
    const isClosed = startEndDist < diagonal * 0.25 || startEndDist < 40;
    
    // Calculate distance details from centroid to assess circularity
    const distances = points.map(p => this.getDistance(p, centroid));
    const meanDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - meanDistance, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);
    const circularity = meanDistance > 0 ? stdDev / meanDistance : 1; // Lower stdDev/mean ratio means more circular

    // Check for underline: mostly horizontal, start/end far apart, low height
    const isHorizontal = bounds.width > bounds.height * 2.5 && bounds.height < 100;
    const isUnderline = isHorizontal && !isClosed && (startEndDist > bounds.width * 0.7);

    // Check for cross (scribble/scratch/strike-through)
    // Detect multiple direction reversals (zig-zag)
    let directionChanges = 0;
    let lastDx = 0;
    for (let i = 2; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      if (i > 2) {
        if (Math.sign(dx) !== Math.sign(lastDx) && Math.abs(dx) > 2 && Math.abs(lastDx) > 2) {
          directionChanges++;
        }
      }
      lastDx = dx;
    }
    const isCross = (directionChanges >= 3 && pathLength > diagonal * 1.5) || (points.length > 20 && directionChanges > 4);

    // Check for Question Mark: starts curved (top-left to top-right to center) then goes down
    // Let's analyze quadrants or vertical movement
    const isQuestionMark = this.detectQuestionMark(points, bounds);

    // Determine gesture type
    let type: GestureType = 'unknown';
    let confidence = 0.5;

    if (isCross) {
      type = 'cross';
      confidence = Math.min(0.6 + (directionChanges * 0.05), 0.95);
    } else if (isQuestionMark) {
      type = 'question';
      confidence = 0.8;
    } else if (isClosed) {
      // Circularity < 0.18 is very circular
      if (circularity < 0.20) {
        type = 'circle';
        confidence = Math.min(0.95, 1 - circularity);
      } else {
        // If closed but not circular, it is a rectangle or lasso
        // Let's distinguish by aspect ratio or bounding box coverage
        const rectCoverage = this.getRectangleCoverage(points, bounds);
        if (rectCoverage > 0.75) {
          type = 'rectangle';
          confidence = Math.min(0.9, rectCoverage);
        } else {
          type = 'lasso';
          confidence = 0.8;
        }
      }
    } else if (isUnderline) {
      type = 'underline';
      confidence = Math.min(0.95, bounds.width / (bounds.height + 1) / 5);
    } else {
      // Check for simple checkmark/tick: down then sharp up-right
      const isTick = this.detectTick(points);
      if (isTick) {
        type = 'tick';
        confidence = 0.85;
      } else {
        // Check for arrow
        const isArrow = this.detectArrow(points);
        if (isArrow) {
          type = 'arrow';
          confidence = 0.8;
        } else {
          type = 'unknown';
          confidence = 0.3;
        }
      }
    }

    return {
      type,
      confidence: parseFloat(confidence.toFixed(2)),
      bounds,
      points
    };
  }

  private static getBoundingBox(points: Point[]): BoundingBox {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY)
    };
  }

  private static getCentroid(points: Point[]): Point {
    let sumX = 0;
    let sumY = 0;
    for (const p of points) {
      sumX += p.x;
      sumY += p.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }

  private static getPathLength(points: Point[]): number {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      len += this.getDistance(points[i - 1], points[i]);
    }
    return len;
  }

  private static getDistance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Estimates how much the points fill the bounding box perimeter
   */
  private static getRectangleCoverage(points: Point[], bounds: BoundingBox): number {
    // Simple heuristic: count how many points are close to the edges of the bounding box
    const threshold = Math.max(bounds.width, bounds.height) * 0.15;
    let edgePoints = 0;
    
    for (const p of points) {
      const nearLeft = Math.abs(p.x - bounds.x) < threshold;
      const nearRight = Math.abs(p.x - (bounds.x + bounds.width)) < threshold;
      const nearTop = Math.abs(p.y - bounds.y) < threshold;
      const nearBottom = Math.abs(p.y - (bounds.y + bounds.height)) < threshold;
      
      if (nearLeft || nearRight || nearTop || nearBottom) {
        edgePoints++;
      }
    }
    
    return edgePoints / points.length;
  }

  private static detectQuestionMark(points: Point[], bounds: BoundingBox): boolean {
    if (points.length < 8) return false;
    // Question mark: goes right, then curves down and left, then down vertically.
    // Check if start is in the middle-left, goes up and right, curves down, and ends below start in X.
    const start = points[0];
    const end = points[points.length - 1];
    
    // Top-most point should be in the middle of the stroke index
    let topIdx = 0;
    let minY = Infinity;
    for (let i = 0; i < points.length; i++) {
      if (points[i].y < minY) {
        minY = points[i].y;
        topIdx = i;
      }
    }
    
    // Question mark curves: Top point should be after start, but before end.
    // Also, the overall stroke should have vertical dominance but significant width.
    const hasRightCurve = points.slice(0, topIdx + 5).some(p => p.x > start.x + bounds.width * 0.2);
    const endsBelow = end.y > start.y && Math.abs(end.x - (bounds.x + bounds.width/2)) < bounds.width * 0.3;
    
    return hasRightCurve && endsBelow && bounds.height > bounds.width * 1.1;
  }

  private static detectTick(points: Point[]): boolean {
    // A checkmark/tick: starts high, goes down-right, then sharp bend, and goes up-right (longer).
    if (points.length < 6) return false;
    
    // Find index of the lowest point (the vertex of the tick)
    let lowestIdx = 0;
    let maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      if (points[i].y > maxY) {
        maxY = points[i].y;
        lowestIdx = i;
      }
    }
    
    // Lowest point shouldn't be at the start or the end
    if (lowestIdx <= 1 || lowestIdx >= points.length - 2) return false;
    
    const start = points[0];
    const vertex = points[lowestIdx];
    const end = points[points.length - 1];
    
    // Start should be higher than vertex (y is smaller)
    // End should be higher than vertex
    // Left segment: down and right
    // Right segment: up and right
    const leftDown = vertex.y > start.y && vertex.x > start.x;
    const rightUp = end.y < vertex.y && end.x > vertex.x;
    const rightLegLonger = this.getDistance(vertex, end) > this.getDistance(start, vertex) * 0.8;
    
    return leftDown && rightUp && rightLegLonger;
  }

  private static detectArrow(points: Point[]): boolean {
    // Arrow: single stroke showing a stem then a sharp reversal at the tip (arrowhead)
    // Or we can look for a sharp angle change (>100 deg) at the last 20% of points.
    if (points.length < 10) return false;
    
    // Scan for sharp angle changes in the last portion
    const startIndex = Math.floor(points.length * 0.6);
    for (let i = startIndex; i < points.length - 2; i++) {
      const p1 = points[i - 2];
      const p2 = points[i];
      const p3 = points[i + 2];
      
      const v1 = { x: p2.x - p1.x, y: p2.y - p1.y };
      const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
      
      const len1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const len2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      
      if (len1 > 0 && len2 > 0) {
        const dot = (v1.x * v2.x + v1.y * v2.y) / (len1 * len2);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
        if (angle > 110) {
          // Found a sharp corner! Check if the segment after the corner is short
          const postCornerLen = this.getPathLength(points.slice(i));
          const preCornerLen = this.getPathLength(points.slice(0, i));
          if (postCornerLen < preCornerLen * 0.5) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // --- CUSTOM GESTURE TEMPLATE MATCHING ALGORITHMS ---

  private static resample(points: Point[], n: number): Point[] {
    const pathLen = this.getPathLength(points);
    if (pathLen === 0) {
      // Avoid division by zero, return array of first point
      return Array(n).fill(0).map(() => ({ ...points[0] }));
    }
    const I = pathLen / (n - 1);
    let D = 0.0;
    const newPoints: Point[] = [points[0]];
    const pts = [...points];

    for (let i = 1; i < pts.length; i++) {
      const d = this.getDistance(pts[i - 1], pts[i]);
      if (D + d >= I) {
        const qx = pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x);
        const qy = pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y);
        const q = { x: qx, y: qy, t: pts[i].t };
        newPoints.push(q);
        pts.splice(i, 0, q); // insert q as next point
        D = 0.0;
      } else {
        D += d;
      }
    }

    while (newPoints.length < n) {
      newPoints.push({ ...points[points.length - 1] });
    }
    if (newPoints.length > n) {
      newPoints.length = n;
    }
    return newPoints;
  }

  private static translateTo(points: Point[], centroid: Point): Point[] {
    return points.map(p => ({ x: p.x - centroid.x, y: p.y - centroid.y, t: p.t }));
  }

  private static scaleTo(points: Point[], size: number): Point[] {
    const box = this.getBoundingBox(points);
    const boxWidth = Math.max(1, box.width);
    const boxHeight = Math.max(1, box.height);
    return points.map(p => ({
      x: p.x * (size / boxWidth),
      y: p.y * (size / boxHeight),
      t: p.t
    }));
  }

  public static normalizePath(points: Point[]): Point[] {
    const resampled = this.resample(points, 32);
    const centroid = this.getCentroid(resampled);
    const translated = this.translateTo(resampled, centroid);
    const scaled = this.scaleTo(translated, 100);
    return scaled;
  }

  private static pathDistance(pts1: Point[], pts2: Point[]): number {
    let d = 0;
    const len = Math.min(pts1.length, pts2.length);
    for (let i = 0; i < len; i++) {
      d += this.getDistance(pts1[i], pts2[i]);
    }
    return d / len;
  }

  private static recognizeCustom(points: Point[]): Gesture | null {
    try {
      const templatesStr = localStorage.getItem('inkos_custom_gestures');
      if (!templatesStr) return null;
      const templates = JSON.parse(templatesStr) as CustomGestureTemplate[];
      if (templates.length === 0) return null;

      const normalizedInput = this.normalizePath(points);
      let bestTemplate: CustomGestureTemplate | null = null;
      let lowestScore = Infinity;

      for (const t of templates) {
        const dist = this.pathDistance(normalizedInput, t.normalizedPoints);
        if (dist < lowestScore) {
          lowestScore = dist;
          bestTemplate = t;
        }
      }

      // Distance threshold of 18.0 normalized coordinates
      if (bestTemplate && lowestScore < 18.0) {
        const bounds = this.getBoundingBox(points);
        return {
          type: bestTemplate.name.toLowerCase(),
          confidence: parseFloat(Math.max(0.6, 1.0 - (lowestScore / 30)).toFixed(2)),
          bounds,
          points
        };
      }
    } catch (e) {
      console.error('Failed to recognize custom template', e);
    }
    return null;
  }
}
