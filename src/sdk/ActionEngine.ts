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

      case 'explain_code':
        return this.explainCode(context);

      case 'image_search':
        return this.visualSearch(context);

      case 'image_ocr':
        return this.imageOcr(context);

      case 'table_export':
        return this.exportTable(context);

      case 'canvas_clear':
        return { success: true, message: 'Screen cleared successfully.' };

      case 'capture_screenshot':
        return { 
          success: true, 
          message: 'Screenshot captured.', 
          displayHtml: `<div class="info-card">Captured bounding box: ${Math.round(gesture.bounds.width)}x${Math.round(gesture.bounds.height)}px at x:${Math.round(gesture.bounds.x)}, y:${Math.round(gesture.bounds.y)}</div>`
        };

      default:
        return { success: false, message: `Action ${actionId} not implemented.` };
    }
  }

  // --- ACTIONS IMPLEMENTATIONS ---

  private static solveMath(context: ContextElement): ActionResult {
    let expression = context.content.replace(/=/g, '').trim();
    // Safety filter for math characters
    expression = expression.replace(/[^0-9\+\-\*\/\(\)\.\s]/g, '');

    try {
      // Evaluate the sanitized math string
      const result = new Function(`return (${expression})`)();
      
      if (result === undefined || isNaN(result)) {
        return { success: false, message: 'Math evaluation failed. Invalid expression.' };
      }

      return {
        success: true,
        data: { expression, result },
        displayHtml: `
          <div class="math-result-card">
            <span class="math-expr">${expression} = </span>
            <span class="math-val">${result}</span>
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
          <div class="copy-success-card">
            <span>📋 ${label} Copied:</span>
            <code class="truncated-copy">${text.length > 60 ? text.substring(0, 57) + '...' : text}</code>
          </div>
        `
      };
    } catch (err) {
      // Fallback
      return {
        success: true,
        message: `${label} copied (simulated)`,
        displayHtml: `
          <div class="copy-success-card">
            <span>📋 ${label} Copied (simulated):</span>
            <code class="truncated-copy">${text}</code>
          </div>
        `
      };
    }
  }

  private static translateText(context: ContextElement): ActionResult {
    const text = context.content.trim();
    
    // Check known text translations for the simulator targets
    const translations: Record<string, { en: string; detected: string }> = {
      "La vie est belle, pleine de défis mais aussi de moments extraordinaires.": {
        en: "Life is beautiful, full of challenges but also extraordinary moments.",
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
        <div class="translation-card">
          <div class="translation-header">Translated from <strong>${entry.detected}</strong></div>
          <blockquote class="translation-source">"${text}"</blockquote>
          <div class="translation-dest">✨ "${entry.en}"</div>
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
        <div class="search-card">
          <h4>Web Search Results</h4>
          <p>Query: "<em>${context.content.trim()}</em>"</p>
          <a href="${searchUrl}" target="_blank" class="search-btn-link">View on Google 🔗</a>
          <div class="search-preview-box">
            <div class="preview-item">
              <span class="preview-title">${context.content} - Wikipedia</span>
              <span class="preview-url">en.wikipedia.org &rsaquo; wiki</span>
              <p class="preview-snippet">Information, history, and resources related to ${context.content} collected from around the web...</p>
            </div>
          </div>
        </div>
      `
    };
  }

  private static explainText(context: ContextElement): ActionResult {
    const topic = context.content.trim();
    
    const explanation = `
      <div class="ai-card">
        <div class="ai-header">🧠 AI Explanation</div>
        <h4>Understanding "${topic.length > 40 ? topic.substring(0, 37) + '...' : topic}"</h4>
        <p>This phrase refers to a core conceptual topic. In context, it represents a foundational idea within the material:</p>
        <ul>
          <li><strong>Contextual Importance:</strong> Key element in the current page structure.</li>
          <li><strong>Core Meaning:</strong> Outlines a framework for interpreting intent or actions.</li>
          <li><strong>Key Takeaway:</strong> Drawing directly on top of items bridges the gap between screen context and intent recognition.</li>
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
      <div class="ai-card">
        <div class="ai-header">📝 AI Summary</div>
        <p>Here is a concise breakdown of the selected text:</p>
        <ul class="summary-bullets">
          <li><strong>Primary Thesis:</strong> Computational interfaces are transitioning from rigid inputs (keyboard/mouse) to natural overlays (intent through ink).</li>
          <li><strong>Objective:</strong> Eliminating context switching (opening apps, copy-pasting) by carrying out actions directly on the current canvas.</li>
          <li><strong>Architecture:</strong> Composed of a lightweight Shell Application and a core Engine SDK running gesture/context analyzers.</li>
        </ul>
      </div>
    `;

    return {
      success: true,
      displayHtml: summary
    };
  }

  private static explainCode(_context: ContextElement): ActionResult {
    const explanation = `
      <div class="ai-card code-explanation">
        <div class="ai-header">💻 AI Code Explainer</div>
        <p>This code block performs the following actions:</p>
        <ol>
          <li><strong>Iterative Fitting:</strong> Scans point lists to compute cumulative distance features.</li>
          <li><strong>Vector Alignment:</strong> Uses the dot product of successive tangent vectors to identify sudden directional changes (corners).</li>
          <li><strong>Angle Thresholding:</strong> Flags any corner with an angle greater than 110&deg; that exists near the terminal end of the drawing stroke as a candidate arrowhead.</li>
        </ol>
        <div class="ai-tip">💡 <strong>Tip:</strong> This algorithm forms the basis of the local gesture recognition for Arrows.</div>
      </div>
    `;

    return {
      success: true,
      displayHtml: explanation
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
      <div class="visual-search-card">
        <div class="vs-header">🛍️ InkOS Visual Shop</div>
        <div class="vs-product-info">
          <strong>${productName}</strong>
          <span class="vs-orig-price">Identified Price: ${price}</span>
        </div>
        <div class="vs-matches">
          <h5>Best Prices Found Online:</h5>
          ${matches.map(m => `
            <div class="vs-match-row">
              <div class="vs-store">
                <strong>${m.store}</strong>
                <span>${m.rating}</span>
              </div>
              <div class="vs-price">${m.price}</div>
              <button class="vs-buy-btn" onclick="alert('Simulating purchase from ${m.store}')">Buy</button>
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

  private static imageOcr(context: ContextElement): ActionResult {
    const text = context.metadata?.ocrText || 'TIMING IS EVERYTHING';
    return {
      success: true,
      data: { text },
      displayHtml: `
        <div class="ocr-card">
          <div class="ocr-header">📷 OCR Text Extracted</div>
          <div class="ocr-result-text">"${text}"</div>
          <button class="ocr-copy-btn" id="ocr-copy-btn-action">Copy Extracted Text 📋</button>
        </div>
      `
    };
  }

  private static exportTable(_context: ContextElement): ActionResult {
    // Standard mock table CSV conversion
    const rows = [
      ['Plugin ID', 'Name', 'Category', 'Rating'],
      ['finance_plugin', 'Finance & Markets', 'Productivity', '4.8'],
      ['dev_plugin', 'Developer Toolbox', 'Utilities', '4.9'],
      ['travel_plugin', 'Travel Buddy', 'Lifestyle', '4.5']
    ];

    const csvContent = rows.map(r => r.join(',')).join('\n');
    
    const displayHtml = `
      <div class="table-export-card">
        <div class="te-header">📊 Exported Table Data (CSV)</div>
        <pre class="te-csv">${csvContent}</pre>
        <div class="te-actions">
          <button class="te-btn" id="te-copy-btn">Copy CSV 📋</button>
          <button class="te-btn" onclick="alert('CSV file downloaded (simulated)')">Download .csv 📥</button>
        </div>
      </div>
    `;

    return {
      success: true,
      data: { csv: csvContent },
      displayHtml
    };
  }
}
