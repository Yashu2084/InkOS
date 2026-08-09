import type { ContextElement, Gesture, ActionResult } from './types';

export class ActionEngine {
  /**
   * Executes a system action based on the identified intent ID.
   */
  public static async execute(actionId: string, context: ContextElement, gesture: Gesture): Promise<ActionResult> {
    // Add a slight realistic network/AI processing delay (350ms) to show the loading micro-animations
    await new Promise(resolve => setTimeout(resolve, 350));

    switch (actionId) {
      case 'math_solve':
        return this.solveMath(context);
      
      case 'math_graph':
        return this.graphMath(context);

      case 'math_explain':
        return this.explainMath(context);

      case 'copy_text':
        return this.copyToClipboard(context.content, 'Text');
      
      case 'copy_image':
        return this.copyToClipboard(`[Image: ${context.content}]`, 'Image Reference');
      
      case 'translate':
        return this.translateText(context);
      
      case 'search_web':
        return this.searchWeb(context);
      
      case 'explain':
        return this.explainText(context);

      case 'summarize':
        return this.summarizeText(context);

      case 'rewrite':
        return this.rewriteText(context);

      case 'explain_code':
        return this.explainCode(context);

      case 'debug_code':
        return this.debugCode(context);

      case 'optimize_code':
        return this.optimizeCode(context);

      case 'generate_tests':
        return this.generateTests(context);

      case 'refactor_code':
        return this.refactorCode(context);

      case 'image_search':
        return this.visualSearch(context);

      case 'image_describe':
        return this.describeImage(context);

      case 'image_ocr':
        return this.imageOcr(context);

      case 'image_save':
        return this.saveImage(context);

      case 'image_find_similar':
        return this.imageFindSimilar(context);

      case 'analyze_table':
        return this.analyzeTable(context);

      case 'table_export':
        return this.exportTable(context);

      case 'table_visualize':
        return this.visualizeTable(context);

      case 'canvas_clear':
        return { success: true, message: 'Screen cleared successfully.' };

      case 'open_settings':
        return { success: true, message: 'Navigating to Settings panel.' };

      case 'capture_screenshot':
        return { 
          success: true, 
          message: 'Screenshot captured.', 
          displayHtml: `<div class="info-card" style="font-size: 0.85rem;">Captured bounding box: ${Math.round(gesture.bounds.width)}x${Math.round(gesture.bounds.height)}px at x:${Math.round(gesture.bounds.x)}, y:${Math.round(gesture.bounds.y)}</div>`
        };

      default:
        return { success: false, message: `Action ${actionId} not implemented.` };
    }
  }

  // --- ACTIONS IMPLEMENTATIONS ---

  private static solveMath(context: ContextElement): ActionResult {
    let expression = context.content.replace(/=/g, '').trim();
    expression = expression.replace(/[^0-9\+\-\*\/\(\)\.\s]/g, '');

    try {
      const result = new Function(`return (${expression})`)();
      
      if (result === undefined || isNaN(result)) {
        return { success: false, message: 'Math evaluation failed. Invalid expression.' };
      }

      return {
        success: true,
        data: { expression, result },
        displayHtml: `
          <div class="math-result-card" style="text-align: center; padding: 10px;">
            <div class="math-expr" style="font-size: 0.9rem; color: var(--text-secondary); font-family: var(--font-mono);">${expression} = </div>
            <div class="math-val" style="font-size: 1.8rem; font-weight: 700; color: var(--color-cyan); font-family: var(--font-mono);">${result}</div>
          </div>
        `
      };
    } catch (e) {
      return { success: false, message: 'Could not evaluate equation: ' + expression };
    }
  }

  private static async copyToClipboard(text: string, label: string): Promise<ActionResult> {
    try {
      await navigator.clipboard.writeText(text);
      return {
        success: true,
        message: `${label} copied to clipboard!`,
        displayHtml: `
          <div class="copy-success-card" style="display: flex; flex-direction: column; gap: 8px;">
            <span style="font-weight: 600; font-size: 0.9rem;">📋 ${label} Copied:</span>
            <code class="truncated-copy" style="background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.75rem; display: block; word-break: break-all;">${text.length > 60 ? text.substring(0, 57) + '...' : text}</code>
          </div>
        `
      };
    } catch (err) {
      return {
        success: true,
        message: `${label} copied (simulated)`,
        displayHtml: `
          <div class="copy-success-card" style="display: flex; flex-direction: column; gap: 8px;">
            <span style="font-weight: 600; font-size: 0.9rem;">📋 ${label} Copied (simulated):</span>
            <code class="truncated-copy" style="background: rgba(0,0,0,0.03); padding: 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.75rem; display: block; word-break: break-all;">${text}</code>
          </div>
        `
      };
    }
  }

  private static translateText(context: ContextElement): ActionResult {
    const text = context.content.trim();
    const translations: Record<string, { en: string; detected: string }> = {
      "La vie est belle, pleine de défis mais aussi de moments extraordinaires.": {
        en: "Life is beautiful, full of challenges but also extraordinary moments.",
        detected: "French"
      },
      "La technologie moderne doit simplifier la vie humaine et inspirer la créativité.": {
        en: "Modern technology must simplify human life and inspire creativity.",
        detected: "French"
      },
      "El camino del éxito requiere esfuerzo constante, paciencia y una visión clara.": {
        en: "The path of success requires constant effort, patience, and a clear vision.",
        detected: "Spanish"
      }
    };

    const entry = translations[text] || {
      en: `[Translated] ${text} (Fallback translation simulation)`,
      detected: 'Auto-detected'
    };

    return {
      success: true,
      data: { original: text, translation: entry.en, language: entry.detected },
      displayHtml: `
        <div class="translation-card" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="translation-header" style="font-size: 0.75rem; color: var(--text-secondary);">Translated from <strong>${entry.detected}</strong></div>
          <blockquote class="translation-source" style="font-size: 0.8rem; font-style: italic; color: var(--text-muted); border-left: 2px solid var(--glass-border); padding-left: 8px;">"${text}"</blockquote>
          <div class="translation-dest" style="font-size: 0.95rem; font-weight: 500; color: var(--color-cyan);">✨ "${entry.en}"</div>
        </div>
      `
    };
  }

  private static searchWeb(context: ContextElement): ActionResult {
    const query = encodeURIComponent(context.content.trim());
    const searchUrl = `https://www.google.com/search?q=${query}`;

    return {
      success: true,
      data: { query, url: searchUrl },
      displayHtml: `
        <div class="search-card" style="display: flex; flex-direction: column; gap: 10px;">
          <h4 style="font-size: 0.95rem;">Web Search Results</h4>
          <p style="font-size: 0.8rem;">Query: "<em>${context.content.trim()}</em>"</p>
          <a href="${searchUrl}" target="_blank" class="search-btn-link" style="display: inline-block; background: var(--color-cyan); color: white; text-decoration: none; padding: 8px 12px; border-radius: var(--radius-inner); font-size: 0.8rem; font-weight: 600; text-align: center;">View on Google 🔗</a>
        </div>
      `
    };
  }

  private static explainText(context: ContextElement): ActionResult {
    const topic = context.content.trim();
    const explanation = `
      <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px;">
        <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">🧠 AI Explanation</div>
        <h4 style="font-size: 0.95rem;">Understanding: "${topic.length > 30 ? topic.substring(0, 27) + '...' : topic}"</h4>
        <p style="font-size: 0.8rem; line-height: 1.4;">This selection outlines a fundamental concept regarding human-computer interfaces:</p>
        <ul style="font-size: 0.8rem; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;">
          <li><strong>Universal Overlay:</strong> Canvas structures capture coordinates without interrupting operational flow.</li>
          <li><strong>Intelligent Intent:</strong> Simple gestures normalize shapes directly to programmatic triggers.</li>
        </ul>
      </div>
    `;

    return {
      success: true,
      displayHtml: explanation
    };
  }

  private static summarizeText(_context: ContextElement): ActionResult {
    const summary = `
      <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px;">
        <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">📝 AI Summary</div>
        <p style="font-size: 0.85rem; font-weight: 500;">Core Key Takeaways:</p>
        <ul class="summary-bullets" style="font-size: 0.8rem; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;">
          <li><strong>Eliminating Context Switches:</strong> Users draw ink directly over content instead of switching window tabs.</li>
          <li><strong>Dual Engine SDK:</strong> A core high-performance classifier registry wired alongside DOM coordinate scanners.</li>
        </ul>
      </div>
    `;

    return {
      success: true,
      displayHtml: summary
    };
  }

  private static rewriteText(context: ContextElement): ActionResult {
    const originalText = context.content.trim();
    
    // AI rewrite paraphrasing mock
    const rewrites: Record<string, string> = {
      "InkOS introducing Intent Through Ink. Users interact naturally with whatever is already on their screen, preventing app switches.":
        "By presenting Intent Through Ink, InkOS lets users naturally draw on top of visible elements, avoiding workspace interruptions."
    };

    const paraphrased = rewrites[originalText] || `[Paraphrased] InkOS overrides traditional input mechanics, establishing instant canvas gesture matches to bypass context swapping.`;

    return {
      success: true,
      data: { original: originalText, rewrite: paraphrased },
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">✍️ AI Rewrite</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); border-left: 2px solid var(--glass-border); padding-left: 8px;">Original: "${originalText.substring(0, 60)}..."</div>
          <div style="font-size: 0.85rem; font-weight: 500; color: var(--text-primary); margin-top: 4px;">✨ "${paraphrased}"</div>
        </div>
      `
    };
  }

  private static explainCode(_context: ContextElement): ActionResult {
    const explanation = `
      <div class="ai-card code-explanation" style="display: flex; flex-direction: column; gap: 10px;">
        <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">💻 AI Code Explainer</div>
        <p style="font-size: 0.8rem; line-height: 1.4;">This JavaScript script calculates sales transactions:</p>
        <ol style="font-size: 0.8rem; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;">
          <li>Defines a base price of <strong>249</strong> and discount fraction of <strong>0.15</strong> (15%).</li>
          <li>Applies the discount using standard subtraction multipliers.</li>
          <li>Prints the calculated product price formatted as a string value.</li>
        </ol>
      </div>
    `;

    return {
      success: true,
      displayHtml: explanation
    };
  }

  private static debugCode(_context: ContextElement): ActionResult {
    return {
      success: true,
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <div class="ai-header" style="font-size: 0.75rem; color: var(--color-danger); font-weight: 600; text-transform: uppercase;">🐞 AI Debugger Output</div>
          <span style="font-size: 0.8rem; font-weight: 500;">Found 1 potential bug: lack of float precision limits.</span>
          <pre style="background: rgba(255, 90, 95, 0.05); border: 1px solid rgba(255, 90, 95, 0.2); padding: 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-danger); line-height: 1.3;">
- const finalPrice = price * (1 - discount);
+ // Fix: Round to 2 decimals to prevent binary float inaccuracies
+ const finalPrice = Math.round(price * (1 - discount) * 100) / 100;</pre>
        </div>
      `
    };
  }

  private static optimizeCode(_context: ContextElement): ActionResult {
    return {
      success: true,
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">🚀 AI Code Optimizer</div>
          <span style="font-size: 0.8rem; font-weight: 500;">Refactored to reduce temporary stack variable usage:</span>
          <pre style="background: rgba(0, 122, 255, 0.05); border: 1px solid rgba(0, 122, 255, 0.15); padding: 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-cyan); line-height: 1.3;">
// Optimized one-liner layout
console.log('Final Calculated Price:', '$' + (249 * 0.85).toFixed(2));</pre>
          <span style="font-size: 0.7rem; color: var(--text-secondary);">Reduces memory heap allocations to O(1) complexity.</span>
        </div>
      `
    };
  }

  private static generateTests(_context: ContextElement): ActionResult {
    return {
      success: true,
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">🧪 AI Unit Test Generator</div>
          <span style="font-size: 0.8rem; font-weight: 500;">Vitest/Jest Specification Code:</span>
          <pre style="background: rgba(0, 0, 0, 0.02); border: 1px solid var(--glass-border); padding: 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.65rem; color: var(--text-primary); line-height: 1.3; max-height: 120px; overflow-y: auto;">
import { describe, it, expect } from 'vitest';

describe('Discount Math', () => {
  it('correctly calculates final price', () => {
    const price = 249;
    const discount = 0.15;
    const finalPrice = price * (1 - discount);
    expect(finalPrice).toBe(211.65);
  });
});</pre>
        </div>
      `
    };
  }

  private static visualSearch(context: ContextElement): ActionResult {
    const productName = context.content;
    const price = context.metadata?.price || '$199.00';
    const matches = [
      { store: 'Chronos Watches', price: price, rating: '⭐⭐⭐⭐⭐ (4.9)' },
      { store: 'WatchFinder', price: '$210.00', rating: '⭐⭐⭐⭐☆ (4.2)' },
      { store: 'TimeKeepers', price: '$189.99', rating: '⭐⭐⭐⭐★ (4.5)' }
    ];

    const displayHtml = `
      <div class="visual-search-card" style="display: flex; flex-direction: column; gap: 10px;">
        <div class="vs-header" style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-cyan); font-weight: 600;">🛍️ Visual Shop Matches</div>
        <div class="vs-product-info" style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid rgba(0,0,0,0.05); padding-bottom: 6px;">
          <strong style="font-size: 0.9rem;">${productName}</strong>
          <span class="vs-orig-price" style="font-size: 0.75rem; color: var(--text-secondary);">${price}</span>
        </div>
        <div class="vs-matches" style="display: flex; flex-direction: column; gap: 8px;">
          ${matches.map(m => `
            <div class="vs-match-row" style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.02); padding: 8px; border-radius: 6px; border: 1px solid var(--glass-border);">
              <div class="vs-store" style="display: flex; flex-direction: column;">
                <strong style="font-size: 0.8rem;">${m.store}</strong>
                <span style="font-size: 0.65rem; color: var(--text-muted);">${m.rating}</span>
              </div>
              <div class="vs-price" style="font-size: 0.85rem; font-weight: 600; color: var(--color-success);">${m.price}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    return {
      success: true,
      data: { productName, price, matches },
      displayHtml
    };
  }

  private static describeImage(context: ContextElement): ActionResult {
    const name = context.content;
    const ocrText = context.metadata?.ocrText || '';
    
    return {
      success: true,
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">👁️ AI Image Describer</div>
          <h5 style="font-weight: 600; font-size: 0.85rem;">Object: ${name}</h5>
          <ul style="font-size: 0.8rem; padding-left: 18px; display: flex; flex-direction: column; gap: 4px;">
            <li><strong>Classification:</strong> Luxury consumer accessory.</li>
            <li><strong>Key Elements:</strong> Dial markers, wrist strap layout.</li>
            <li><strong>OCR Text detected:</strong> "${ocrText}"</li>
          </ul>
        </div>
      `
    };
  }

  private static imageOcr(context: ContextElement): ActionResult {
    const text = context.metadata?.ocrText || 'TIMING IS EVERYTHING';
    return {
      success: true,
      data: { text },
      displayHtml: `
        <div class="ocr-card" style="display: flex; flex-direction: column; gap: 10px; text-align: center;">
          <div class="ocr-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">📷 OCR Text Extracted</div>
          <div class="ocr-result-text" style="font-family: var(--font-mono); background: rgba(0,0,0,0.03); padding: 10px; border-radius: 6px; font-size: 0.85rem; color: var(--color-cyan);">${text}</div>
          <button class="ocr-copy-btn" id="ocr-copy-btn-action" style="background: var(--color-cyan); color: white; border: none; padding: 8px 12px; border-radius: var(--radius-inner); font-size: 0.8rem; cursor: pointer; font-weight: 500;">Copy Extracted Text 📋</button>
        </div>
      `
    };
  }

  private static saveImage(context: ContextElement): ActionResult {
    return {
      success: true,
      message: `Image saved (download simulated)`,
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 8px; text-align: center;">
          <span style="font-size: 1.5rem;">💾</span>
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--color-success);">Asset Downloaded!</span>
          <span style="font-size: 0.75rem; color: var(--text-secondary);">${context.content}.jpg</span>
        </div>
      `
    };
  }

  private static analyzeTable(_context: ContextElement): ActionResult {
    // Perform simulated data aggregates on table
    const rows = [
      { name: 'finance_plugin', rating: 4.8 },
      { name: 'dev_plugin', rating: 4.9 },
      { name: 'travel_plugin', rating: 4.5 }
    ];

    const sum = rows.reduce((s, r) => s + r.rating, 0);
    const avg = parseFloat((sum / rows.length).toFixed(2));
    const max = Math.max(...rows.map(r => r.rating));
    const min = Math.min(...rows.map(r => r.rating));

    return {
      success: true,
      data: { sum, avg, max, min },
      displayHtml: `
        <div class="table-export-card" style="display: flex; flex-direction: column; gap: 10px;">
          <div class="te-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600;">📊 Table Statistics Analyzer</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div style="background: rgba(0,0,0,0.02); padding: 8px; border-radius: 6px; font-size: 0.75rem;">Sum: <strong>${sum}</strong></div>
            <div style="background: rgba(0,0,0,0.02); padding: 8px; border-radius: 6px; font-size: 0.75rem;">Average: <strong>${avg}</strong></div>
            <div style="background: rgba(0,0,0,0.02); padding: 8px; border-radius: 6px; font-size: 0.75rem;">Max: <strong>${max}</strong></div>
            <div style="background: rgba(0,0,0,0.02); padding: 8px; border-radius: 6px; font-size: 0.75rem;">Min: <strong>${min}</strong></div>
          </div>
        </div>
      `
    };
  }

  private static exportTable(_context: ContextElement): ActionResult {
    const rows = [
      ['Plugin ID', 'Name', 'Category', 'Rating'],
      ['finance_plugin', 'Finance & Markets', 'Productivity', '4.8'],
      ['dev_plugin', 'Developer Toolbox', 'Utilities', '4.9'],
      ['travel_plugin', 'Travel Buddy', 'Lifestyle', '4.5']
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    
    const displayHtml = `
      <div class="table-export-card" style="display: flex; flex-direction: column; gap: 10px;">
        <div class="te-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600;">📊 Exported Table Data (CSV)</div>
        <pre class="te-csv" style="font-family: var(--font-mono); font-size: 0.7rem; background: rgba(0,0,0,0.03); padding: 10px; border-radius: 6px; max-height: 100px; overflow-y: auto; white-space: pre-wrap; color: var(--text-primary);">${csvContent}</pre>
        <div class="te-actions" style="display: flex; gap: 8px;">
          <button class="te-btn" id="te-copy-btn" style="flex: 1; background: var(--color-cyan); color: white; border: none; padding: 8px 12px; border-radius: var(--radius-inner); font-size: 0.8rem; cursor: pointer; font-weight: 500;">Copy CSV 📋</button>
        </div>
      </div>
    `;

    return {
      success: true,
      data: { csv: csvContent },
      displayHtml
    };
  }

  private static graphMath(_context: ContextElement): ActionResult {
    return {
      success: true,
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px; text-align: center; width: 100%;">
          <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">📊 Math Function Graph</div>
          <span style="font-size: 0.8rem; font-weight: 500;">Plotted values for f(x) = 125 * x:</span>
          <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--glass-border); border-radius: 6px; padding: 12px; display: flex; justify-content: center; align-items: center; height: 110px;">
            <svg width="220" height="90" viewBox="0 0 220 90" style="overflow: visible;">
              <line x1="20" y1="80" x2="200" y2="80" stroke="var(--text-secondary)" stroke-width="1.5" />
              <line x1="20" y1="10" x2="20" y2="80" stroke="var(--text-secondary)" stroke-width="1.5" />
              <path d="M 20 80 Q 110 50 200 15" fill="none" stroke="var(--color-cyan)" stroke-width="2.5" />
              <circle cx="20" cy="80" r="4" fill="var(--color-cyan)" />
              <circle cx="110" cy="50" r="4" fill="var(--color-cyan)" />
              <circle cx="200" cy="15" r="4" fill="var(--color-cyan)" />
            </svg>
          </div>
        </div>
      `
    };
  }

  private static explainMath(_context: ContextElement): ActionResult {
    return {
      success: true,
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 8px;">
          <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">📚 Mathematical Derivation</div>
          <h5 style="font-weight: 600; font-size: 0.85rem;">Expression: 125 * 8</h5>
          <ol style="font-size: 0.78rem; padding-left: 16px; display: flex; flex-direction: column; gap: 4px; line-height: 1.4; color: var(--text-secondary);">
            <li>125 can be represented as 100 + 20 + 5.</li>
            <li>Distributing the multiplier: (100 * 8) + (20 * 8) + (5 * 8).</li>
            <li>Yields: 800 + 160 + 40 = <strong>1000</strong>.</li>
          </ol>
        </div>
      `
    };
  }

  private static refactorCode(_context: ContextElement): ActionResult {
    return {
      success: true,
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">📄 Refactored Javascript Block</div>
          <span style="font-size: 0.8rem; font-weight: 500;">Converted to functional ES6 declaration:</span>
          <pre style="background: rgba(0, 0, 0, 0.02); border: 1px solid var(--glass-border); padding: 8px; border-radius: 6px; font-family: var(--font-mono); font-size: 0.65rem; color: var(--text-primary); line-height: 1.3;">
const calculatePrice = (price, discount) => price * (1 - discount);
console.log('Final Calculated Price:', \`$\${calculatePrice(249, 0.15).toFixed(2)}\`);</pre>
        </div>
      `
    };
  }

  private static visualizeTable(_context: ContextElement): ActionResult {
    return {
      success: true,
      displayHtml: `
        <div class="ai-card" style="display: flex; flex-direction: column; gap: 10px; width: 100%;">
          <div class="ai-header" style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 600; text-transform: uppercase;">📊 Table Ratings Visualization</div>
          <span style="font-size: 0.78rem; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px;">Vertical Ratings Distribution:</span>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.7rem;">
              <span style="width: 80px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Finance Plugin</span>
              <div style="flex: 1; height: 10px; background: rgba(0, 122, 255, 0.1); border-radius: 4px; overflow: hidden;">
                <div style="width: 96%; height: 100%; background: var(--color-cyan);"></div>
              </div>
              <span style="font-weight: 600; color: var(--color-cyan);">4.8</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px; font-size: 0.7rem;">
              <span style="width: 80px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Dev Sandbox</span>
              <div style="flex: 1; height: 10px; background: rgba(0, 122, 255, 0.1); border-radius: 4px; overflow: hidden;">
                <div style="width: 98%; height: 100%; background: var(--color-cyan);"></div>
              </div>
              <span style="font-weight: 600; color: var(--color-cyan);">4.9</span>
            </div>
          </div>
        </div>
      `
    };
  }

  private static imageFindSimilar(context: ContextElement): ActionResult {
    const assetName = context.content || 'luxury watch';
    return {
      success: true,
      displayHtml: `
        <div style="display: flex; flex-direction: column; gap: 12px; max-width: 320px;">
          <div style="font-size: 0.75rem; text-transform: uppercase; color: var(--color-cyan); font-weight: 700; letter-spacing: 0.5px; margin-bottom: 2px;">🛒 Visual Commerce Matches</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 4px;">Found similar matches for "<strong>${assetName}</strong>":</div>
          
          <div style="display: flex; gap: 12px; overflow-x: auto; padding-bottom: 6px;">
            <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--glass-border); padding: 8px; border-radius: 8px; flex: 0 0 100px; text-align: center;">
              <div style="height: 60px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.01); border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
                <img src="/heritage_watch.jpg" alt="heritage" style="max-height: 90%; max-width: 90%; object-fit: contain;" />
              </div>
              <div style="font-size: 0.7rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Chrono A1</div>
              <div style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 700; margin-top: 2px;">$249</div>
            </div>
            
            <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--glass-border); padding: 8px; border-radius: 8px; flex: 0 0 100px; text-align: center;">
              <div style="height: 60px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.01); border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
                <img src="/heritage_watch.jpg" alt="heritage" style="max-height: 90%; max-width: 90%; object-fit: contain; filter: hue-rotate(90deg);" />
              </div>
              <div style="font-size: 0.7rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Classic Azure</div>
              <div style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 700; margin-top: 2px;">$289</div>
            </div>
            
            <div style="background: rgba(0,0,0,0.02); border: 1px solid var(--glass-border); padding: 8px; border-radius: 8px; flex: 0 0 100px; text-align: center;">
              <div style="height: 60px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.01); border-radius: 4px; overflow: hidden; margin-bottom: 6px;">
                <img src="/heritage_watch.jpg" alt="heritage" style="max-height: 90%; max-width: 90%; object-fit: contain; filter: saturate(0.2);" />
              </div>
              <div style="font-size: 0.7rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Monochrome</div>
              <div style="font-size: 0.75rem; color: var(--color-cyan); font-weight: 700; margin-top: 2px;">$310</div>
            </div>
          </div>
          
          <button id="te-copy-btn" class="composer-btn-sm" style="font-size: 0.75rem; width: 100%; margin-top: 4px; padding: 6px 10px;">Compare Prices & Specs</button>
        </div>
      `
    };
  }
}

