import type { Point, Gesture, BoundingBox, CustomGestureTemplate } from './types';

export class GestureEngine {
  /**
   * Preprocesses raw noisy point coordinates.
   */
  public static preprocessPoints(points: Point[]): Point[] {
    if (points.length < 3) return points;
    
    // 1. Remove duplicates / extremely close consecutive points
    const filtered: Point[] = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const p1 = filtered[filtered.length - 1];
      const p2 = points[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1.5) {
        filtered.push(p2);
      }
    }
    
    if (filtered.length < 3) return filtered;
    
    // 2. Smooth points using moving average window of 3
    const smoothed: Point[] = [filtered[0]];
    for (let i = 1; i < filtered.length - 1; i++) {
      const prev = filtered[i - 1];
      const curr = filtered[i];
      const next = filtered[i + 1];
      smoothed.push({
        x: (prev.x + curr.x + next.x) / 3,
        y: (prev.y + curr.y + next.y) / 3,
        t: curr.t,
        pressure: curr.pressure
      });
    }
    smoothed.push(filtered[filtered.length - 1]);
    
    return smoothed;
  }

  /**
   * Recognizes a gesture from a sequence of points.
   */
  public static recognize(points: Point[]): Gesture {
    if (points.length < 3) {
      return {
        type: 'unknown',
        confidence: 0,
        bounds: this.getBoundingBox(points),
        points
      };
    }

    // Preserve original bounding box
    const bounds = this.getBoundingBox(points);
    
    // Preprocess raw points
    const smoothedPoints = this.preprocessPoints(points);

    // 0. Check custom template registry first
    const customMatch = this.recognizeCustom(smoothedPoints);
    if (customMatch) {
      return customMatch;
    }

    const centroid = this.getCentroid(smoothedPoints);

    const startEndDist = this.getDistance(smoothedPoints[0], smoothedPoints[smoothedPoints.length - 1]);
    const diagonal = Math.sqrt(bounds.width * bounds.width + bounds.height * bounds.height);

    // Heuristics calculations
    const isClosed = startEndDist < diagonal * 0.35 || startEndDist < 50;
    
    // Calculate distance details from centroid to assess circularity
    const distances = smoothedPoints.map(p => this.getDistance(p, centroid));
    const meanDistance = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - meanDistance, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);
    const circularity = meanDistance > 0 ? stdDev / meanDistance : 1; 

    // Heuristic scoring for ranking
    const circleScore = isClosed ? Math.max(0.4, 1.0 - (circularity * 1.5)) : 0.0;
    const lassoScore = isClosed ? Math.max(0.3, 1.0 - (startEndDist / (diagonal + 1))) : 0.0;
    const underlineScore = (bounds.width > bounds.height * 2.2 && !isClosed && startEndDist > bounds.width * 0.7) ? 0.92 : 0.1;
    const arrowScore = this.detectArrow(smoothedPoints) ? 0.85 : 0.15;
    const tickScore = this.detectTick(smoothedPoints) ? 0.90 : 0.1;
    const leftrightScore = (bounds.width > bounds.height * 2.2 && !isClosed && smoothedPoints.length > 25) ? 0.88 : 0.1;

    // Rank candidates
    const candidates = [
      { gesture: 'circle', confidence: circleScore },
      { gesture: 'lasso', confidence: lassoScore },
      { gesture: 'underline', confidence: underlineScore },
      { gesture: 'arrow', confidence: arrowScore },
      { gesture: 'tick', confidence: tickScore },
      { gesture: 'leftrightarrow', confidence: leftrightScore }
    ];

    candidates.sort((a, b) => b.confidence - a.confidence);

    let type = candidates[0].gesture;
    let confidence = candidates[0].confidence;
    
    if (confidence < 0.25) {
      type = 'unknown';
      confidence = 0.2;
    }

    const alternatives = candidates.slice(1)
      .filter(c => c.confidence > 0.18)
      .map(c => ({ gesture: c.gesture, confidence: parseFloat(c.confidence.toFixed(2)) }));

    // Extract arrow details
    const sourcePoint = smoothedPoints[0];
    const targetPoint = smoothedPoints[smoothedPoints.length - 1];
    let direction = 'right';
    if (Math.abs(targetPoint.x - sourcePoint.x) > Math.abs(targetPoint.y - sourcePoint.y)) {
      direction = targetPoint.x > sourcePoint.x ? 'right' : 'left';
    } else {
      direction = targetPoint.y > sourcePoint.y ? 'down' : 'up';
    }

    return {
      type,
      confidence: parseFloat(confidence.toFixed(2)),
      bounds,
      points,
      sourcePoint,
      targetPoint,
      direction,
      alternatives
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
