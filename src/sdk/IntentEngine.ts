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
    // --- Context: MULTIPLE / COMPARISON ---
    if (cType === 'multiple' || context.metadata?.compareItems) {
      intents.push({
        id: 'compare',
        label: '⚖️ Compare Items',
        description: 'Compare selected items side-by-side',
        score: 0.98,
        icon: '⚖️',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'copy_text',
        label: '📋 Copy List',
        description: 'Copy selected content details',
        score: 0.80,
        icon: '📋',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: MATH / EQUATION ---
    if (cType === 'math' || cType === 'equation') {
      intents.push({
        id: 'math_solve',
        label: '🧮 Solve',
        description: 'Evaluate mathematical formula',
        score: 0.96,
        icon: '🧮',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'math_graph',
        label: '📊 Graph',
        description: 'Plot equation coordinates',
        score: 0.88,
        icon: '📊',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'explain',
        label: '✨ Explain Math',
        description: 'Get AI breakdown of this equation',
        score: 0.80,
        icon: '✨',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'copy_text',
        label: '📋 Copy Formula',
        description: 'Copy characters to clipboard',
        score: 0.70,
        icon: '📋',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: DATE / TIME / EVENT / DEADLINE ---
    if (cType === 'event' || cType === 'date' || cType === 'time' || cType === 'deadline') {
      intents.push({
        id: 'calendar_add',
        label: '📅 Add to Calendar',
        description: 'Schedule this event on your calendar',
        score: 0.95,
        icon: '📅',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'reminder_set',
        label: '⏰ Set Reminder',
        description: 'Set custom alert for deadline',
        score: 0.90,
        icon: '⏰',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'task_create',
        label: '📝 Create Task',
        description: 'Add to active workspace task-list',
        score: 0.85,
        icon: '📝',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'copy_text',
        label: '📋 Copy Schedule',
        description: 'Copy event string to clipboard',
        score: 0.70,
        icon: '📋',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: PRODUCT ---
    if (cType === 'product') {
      intents.push({
        id: 'compare',
        label: '⚖️ Compare',
        description: 'Compare item specs & reviews',
        score: 0.95,
        icon: '⚖️',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'wishlist_add',
        label: '🛒 Save to Wishlist',
        description: 'Track price & save locally',
        score: 0.90,
        icon: '🛒',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'image_search',
        label: '🔍 Visual Search',
        description: 'Shop visual duplicates online',
        score: 0.85,
        icon: '🔍',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: EMAIL ---
    if (cType === 'email') {
      intents.push({
        id: 'send_email',
        label: '✉ Send Email',
        description: 'Compose email to address',
        score: 0.95,
        icon: '✉',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'copy_text',
        label: '📋 Copy Address',
        description: 'Copy email to clipboard',
        score: 0.85,
        icon: '📋',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: LINK ---
    if (cType === 'link') {
      intents.push({
        id: 'open_link',
        label: '🌐 Open URL',
        description: 'Open website link in new tab',
        score: 0.95,
        icon: '🌐',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'copy_text',
        label: '📋 Copy URL',
        description: 'Copy link to clipboard',
        score: 0.85,
        icon: '📋',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: PHONE ---
    if (cType === 'phone') {
      intents.push({
        id: 'dial_phone',
        label: '📞 Call Number',
        description: 'Initiate call to phone number',
        score: 0.95,
        icon: '📞',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'copy_text',
        label: '📋 Copy Number',
        description: 'Copy number to clipboard',
        score: 0.85,
        icon: '📋',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: CODE ---
    if (cType === 'code') {
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
        label: '🚀 Optimize Code',
        description: 'Improve complexity & clean standard style',
        score: 0.85,
        icon: '🚀',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: TABLE ---
    if (cType === 'table') {
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
        label: '📤 Export Table',
        description: 'Convert table to CSV format',
        score: 0.85,
        icon: '📤',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: IMAGE ---
    if (cType === 'image') {
      intents.push({
        id: 'image_search',
        label: '🔍 Visual Search',
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
        label: '📄 OCR Extract',
        description: 'Extract text inside this image',
        score: 0.85,
        icon: '📄',
        gesture: gType,
        context: cType
      });
      intents.push({
        id: 'image_save',
        label: '🖼 Save Asset',
        description: 'Download image asset locally',
        score: 0.80,
        icon: '🖼',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: GENERAL TEXT ---
    if (cType === 'text') {
      const isFrench = /cette|est|une|le|la|les|pour|dans/i.test(context.content);
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
        description: isFrench ? 'Translate from French to English' : 'Translate text in context',
        score: isFrench ? 0.98 : 0.90, // Boost if French content
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
        label: '📋 Copy Text',
        description: 'Copy text to clipboard',
        score: 0.75,
        icon: '📋',
        gesture: gType,
        context: cType
      });
    }

    // --- Context: EMPTY / CANCEL ---
    if (cType === 'empty') {
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

    // --- Gesture Special Rules (Override scores based on gesture intent) ---
    if (gType === 'underline') {
      // Underline triggers quick focus
      intents.forEach(intent => {
        if (intent.id === 'explain' || intent.id === 'math_solve' || intent.id === 'explain_code' || intent.id === 'translate') {
          intent.score += 0.1; // boost focus actions
        }
      });
    } else if (gType === 'tick') {
      // Tick triggers confirmer
      intents.forEach(intent => {
        if (intent.id === 'calendar_add' || intent.id === 'wishlist_add' || intent.id === 'notes_save') {
          intent.score += 0.15; // boost confirm actions
        }
      });
    } else if (gType === 'leftrightarrow' || gType === 'compare') {
      intents.forEach(intent => {
        if (intent.id === 'compare' || intent.id === 'compare_products') {
          intent.score += 0.2; // boost comparison actions
        }
      });
    }

    // 2. PLUGIN REGISTERED INTENTS
    if (pluginEngine) {
      const pluginIntents = pluginEngine.getIntentsFor(gType, context);
      intents.push(...pluginIntents);
    }

    intents.sort((a, b) => b.score - a.score);

    // Fallback in case no matches
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
