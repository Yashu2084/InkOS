export interface Point {
  x: number;
  y: number;
  t?: number;
  pressure?: number;
}

export type Stroke = Point[];

export type GestureType =
  | 'circle'
  | 'underline'
  | 'arrow'
  | 'lasso'
  | 'rectangle'
  | 'cross'
  | 'question'
  | 'tick'
  | 'unknown'
  | string;

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Gesture {
  type: GestureType;
  confidence: number;
  bounds: BoundingBox;
  points: Point[];
}

export type ContextType = 'text' | 'image' | 'math' | 'table' | 'code' | 'empty';

export interface ContextElement {
  id: string;
  type: ContextType;
  content: string;
  bounds: BoundingBox;
  element: HTMLElement;
  metadata?: any;
}

export interface Intent {
  id: string;
  label: string;
  description: string;
  score: number;
  icon: string;
  gesture: GestureType;
  context: ContextType;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  message?: string;
  displayHtml?: string;
}

export interface InkOSPlugin {
  id: string;
  name: string;
  description: string;
  supportedIntents: {
    gesture: GestureType;
    context: ContextType;
    intentId: string;
    label: string;
    description: string;
    icon: string;
    handler: (context: ContextElement, gesture: Gesture) => Promise<ActionResult>;
  }[];
}

export interface InkOSConfig {
  shortcut: string;
  soundEnabled: boolean;
  activeAIModel: string;
  activePlugins: string[];
}

export interface ActivityLogEntry {
  id: string;
  shape: string;
  contextType: string;
  actionLabel: string;
  timestamp: string;
  status: 'success' | 'failed';
  points: Point[];
}

export interface CustomGestureTemplate {
  name: string;
  normalizedPoints: Point[];
  actionId: string;
}


