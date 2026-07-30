import type { Gesture, ContextElement, Intent } from './types';
import { PluginEngine } from './PluginEngine';

export class IntentEngine {
  /**
   * Combines gesture and context to rank the user's probable intentions.
   */
  public static predict(gesture: Gesture, context: ContextElement, pluginEngine?: PluginEngine): Intent[] {
    const intents: Intent[] = [];
    const gType = gesture.type;
    const cType = context.type;

    // 1. BASELINE SYSTEM INTENTS
    
    // --- Context: MATH ---
    if (cType === 'math') {
      if (gType === 'circle' || gType === 'lasso' || gType === 'rectangle') {
        intents.push({
          id: 'math_solve',
          label: 'Calculate',
          description: 'Evaluate equation instantly',
          score: 0.95,
          icon: '🔢',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'copy_text',
          label: 'Copy Equation',
          description: 'Copy text formula to clipboard',
          score: 0.75,
          icon: '📋',
          gesture: gType,
          context: cType
        });
      }
    }

    // --- Context: TEXT ---
    if (cType === 'text') {
      // Check if text looks like foreign language (has metadata indicating language)
      const isForeign = context.metadata?.language && context.metadata.language !== 'en';
      
      if (gType === 'underline') {
        intents.push({
          id: 'translate',
          label: isForeign ? 'Translate (Auto)' : 'Translate text',
          description: `Translate to English`,
          score: isForeign ? 0.95 : 0.75,
          icon: '🌐',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'summarize',
          label: 'Summarize',
          description: 'Create bullet-point summary',
          score: 0.85,
          icon: '📝',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'copy_text',
          label: 'OCR Copy',
          description: 'Copy selected text to clipboard',
          score: 0.80,
          icon: '📋',
          gesture: gType,
          context: cType
        });
      } else if (gType === 'circle' || gType === 'lasso' || gType === 'rectangle') {
        intents.push({
          id: 'search_web',
          label: 'Search Web',
          description: 'Look up selected phrase on Google',
          score: 0.90,
          icon: '🔍',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'explain',
          label: 'Explain Selection',
          description: 'Get AI explanation of text',
          score: 0.85,
          icon: '🧠',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'copy_text',
          label: 'Copy',
          description: 'Copy text to clipboard',
          score: 0.80,
          icon: '📋',
          gesture: gType,
          context: cType
        });
      } else if (gType === 'question') {
        intents.push({
          id: 'explain',
          label: 'Explain Concept',
          description: 'Get deep AI analysis of this concept',
          score: 0.95,
          icon: '🧠',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'search_web',
          label: 'Search Definition',
          description: 'Search definition online',
          score: 0.70,
          icon: '🔍',
          gesture: gType,
          context: cType
        });
      }
    }

    // --- Context: IMAGE ---
    if (cType === 'image') {
      if (gType === 'circle' || gType === 'lasso' || gType === 'rectangle') {
        intents.push({
          id: 'image_search',
          label: 'Visual Search',
          description: 'Find similar products online',
          score: 0.95,
          icon: '🛍️',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'image_ocr',
          label: 'Extract Text (OCR)',
          description: 'Find text inside this image',
          score: 0.85,
          icon: '📷',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'copy_image',
          label: 'Copy Image',
          description: 'Copy image to clipboard',
          score: 0.70,
          icon: '📋',
          gesture: gType,
          context: cType
        });
      }
    }

    // --- Context: CODE ---
    if (cType === 'code') {
      if (gType === 'circle' || gType === 'lasso' || gType === 'rectangle' || gType === 'question') {
        intents.push({
          id: 'explain_code',
          label: 'Explain Code',
          description: 'AI walk-through of this code block',
          score: 0.95,
          icon: '💻',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'copy_text',
          label: 'Copy Code',
          description: 'Copy code block to clipboard',
          score: 0.85,
          icon: '📋',
          gesture: gType,
          context: cType
        });
      }
    }

    // --- Context: TABLE ---
    if (cType === 'table') {
      if (gType === 'circle' || gType === 'lasso' || gType === 'rectangle') {
        intents.push({
          id: 'table_export',
          label: 'Export CSV',
          description: 'Convert table to CSV / Excel format',
          score: 0.90,
          icon: '📊',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'copy_text',
          label: 'Copy Raw Table',
          description: 'Copy table text to clipboard',
          score: 0.70,
          icon: '📋',
          gesture: gType,
          context: cType
        });
      }
    }

    // --- Context: EMPTY (drawn on empty background) ---
    if (cType === 'empty') {
      if (gType === 'circle' || gType === 'lasso' || gType === 'rectangle') {
        intents.push({
          id: 'canvas_clear',
          label: 'Clear Screen',
          description: 'Clear overlay drawing layer',
          score: 0.85,
          icon: '🧹',
          gesture: gType,
          context: cType
        });
      }
    }

    if (pluginEngine) {
      const pluginIntents = pluginEngine.getIntentsFor(gType, context);
      intents.push(...pluginIntents);
    }

    // Sort by score descending
    intents.sort((a, b) => b.score - a.score);

    // If no intents matched, provide a fallback "Capture Screenshot"
    if (intents.length === 0) {
      intents.push({
        id: 'capture_screenshot',
        label: 'Capture Area',
        description: 'Take screenshot of drawn bounds',
        score: 0.5,
        icon: '📸',
        gesture: gType,
        context: cType
      });
    }

    return intents;
  }
}
