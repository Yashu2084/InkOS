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

    // 0. CHECK CUSTOM REGISTERED GESTURES FIRST
    try {
      const customTemplatesStr = localStorage.getItem('inkos_custom_gestures');
      if (customTemplatesStr) {
        const customTemplates = JSON.parse(customTemplatesStr);
        const matched = customTemplates.find((t: any) => t.name.toLowerCase() === gType);
        if (matched) {
          let label = `Custom: ${matched.name}`;
          let desc = `Trigger mapped custom action`;
          let icon = '✨';

          if (matched.actionId === 'clear_canvas') {
            label = 'Clear Canvas';
            desc = 'Clear the drawing layer';
            icon = '🧹';
          } else if (matched.actionId === 'open_settings') {
            label = 'Open Settings';
            desc = 'Navigate to InkOS Dashboard';
            icon = '⚙️';
          } else if (matched.actionId === 'math_solve') {
            label = '🧮 Solve';
            desc = 'Trigger math equation solver';
            icon = '🧮';
          }

          intents.push({
            id: matched.actionId,
            label,
            description: desc,
            score: 0.99, // Custom templates take highest priority
            icon,
            gesture: gType,
            context: cType
          });
        }
      }
    } catch (e) {
      console.error('Error processing custom templates in IntentEngine', e);
    }

    // 1. BASELINE SYSTEM INTENTS
    
    // --- Context: MATH / EQUATION ---
    if (cType === 'math') {
      if (gType === 'circle' || gType === 'lasso' || gType === 'rectangle') {
        intents.push({
          id: 'math_solve',
          label: '🧮 Solve',
          description: 'Evaluate equation instantly',
          score: 0.95,
          icon: '🧮',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'math_graph',
          label: '📊 Graph',
          description: 'Plot mathematical aggregates',
          score: 0.85,
          icon: '📊',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'math_explain',
          label: '📚 Explain',
          description: 'Walk through equation derivation steps',
          score: 0.80,
          icon: '📚',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'copy_text',
          label: '📋 Copy',
          description: 'Copy formula to clipboard',
          score: 0.70,
          icon: '📋',
          gesture: gType,
          context: cType
        });
      }
    }

    // --- Context: TEXT ---
    if (cType === 'text') {
      if (gType === 'underline' || gType === 'circle' || gType === 'lasso' || gType === 'rectangle') {
        intents.push({
          id: 'explain',
          label: '✨ Explain',
          description: 'Get deep AI analysis of this concept',
          score: 0.95,
          icon: '✨',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'translate',
          label: '🌍 Translate',
          description: 'Translate foreign text in context',
          score: 0.90,
          icon: '🌍',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'summarize',
          label: '📄 Summarize',
          description: 'Create bullet-point summary list',
          score: 0.85,
          icon: '📄',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'copy_text',
          label: '📋 Copy',
          description: 'Copy text to clipboard',
          score: 0.75,
          icon: '📋',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'rewrite',
          label: '✏ Rewrite',
          description: 'Refactor paragraph phrasing',
          score: 0.70,
          icon: '✏',
          gesture: gType,
          context: cType
        });
      } else if (gType === 'question') {
        intents.push({
          id: 'explain',
          label: '✨ Explain',
          description: 'Get deep AI analysis of this concept',
          score: 0.95,
          icon: '✨',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'translate',
          label: '🌍 Translate',
          description: 'Translate text block',
          score: 0.70,
          icon: '🌍',
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
          label: '🔍 Search',
          description: 'Find similar products online',
          score: 0.95,
          icon: '🔍',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'image_describe',
          label: '✨ Describe',
          description: 'AI description of image contents',
          score: 0.90,
          icon: '✨',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'image_ocr',
          label: '📄 OCR',
          description: 'Extract text inside this image',
          score: 0.85,
          icon: '📄',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'image_save',
          label: '🖼 Save',
          description: 'Download image asset locally',
          score: 0.80,
          icon: '🖼',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'image_find_similar',
          label: '🛒 Find Similar',
          description: 'Shop visual duplicates',
          score: 0.75,
          icon: '🛒',
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
          label: '⚡ Explain',
          description: 'AI walk-through of this code block',
          score: 0.95,
          icon: '⚡',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'debug_code',
          label: '🐞 Debug',
          description: 'Identify syntax and logic bugs',
          score: 0.90,
          icon: '🐞',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'optimize_code',
          label: '🚀 Optimize',
          description: 'Improve complexity & clean standard style',
          score: 0.85,
          icon: '🚀',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'refactor_code',
          label: '📄 Refactor',
          description: 'Refactor code structure and readability',
          score: 0.80,
          icon: '📄',
          gesture: gType,
          context: cType
        });
      }
    }

    // --- Context: TABLE ---
    if (cType === 'table') {
      if (gType === 'circle' || gType === 'lasso' || gType === 'rectangle') {
        intents.push({
          id: 'analyze_table',
          label: '📊 Analyze',
          description: 'Statistical summary averages',
          score: 0.95,
          icon: '📊',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'table_visualize',
          label: '📈 Visualize',
          description: 'Plot table data in virtual aggregates',
          score: 0.90,
          icon: '📈',
          gesture: gType,
          context: cType
        });
        intents.push({
          id: 'table_export',
          label: '📤 Export',
          description: 'Convert table to CSV format',
          score: 0.85,
          icon: '📤',
          gesture: gType,
          context: cType
        });
      }
    }

    // --- Context: EMPTY ---
    if (cType === 'empty') {
      if (gType === 'circle' || gType === 'lasso' || gType === 'rectangle') {
        intents.push({
          id: 'canvas_clear',
          label: '🧹 Clear Screen',
          description: 'Clear overlay drawing layer',
          score: 0.85,
          icon: '🧹',
          gesture: gType,
          context: cType
        });
      }
    }

    // 2. PLUGIN REGISTERED INTENTS
    if (pluginEngine) {
      const pluginIntents = pluginEngine.getIntentsFor(gType, context);
      intents.push(...pluginIntents);
    }

    intents.sort((a, b) => b.score - a.score);

    // Fallback
    if (intents.length === 0) {
      intents.push({
        id: 'capture_screenshot',
        label: '📸 Capture Area',
        description: 'Take screenshot of bounds',
        score: 0.5,
        icon: '📸',
        gesture: gType,
        context: cType
      });
    }

    return intents;
  }
}
