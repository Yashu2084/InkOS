import type { InkOSPlugin, GestureType, Intent, ContextElement, Gesture, ActionResult } from './types';

export class PluginEngine {
  private plugins: Map<string, InkOSPlugin> = new Map();

  constructor() {
    // Register default V1 showcase plugins
    this.registerPlugin(this.createFinancePlugin());
    this.registerPlugin(this.createDeveloperPlugin());
  }

  public registerPlugin(plugin: InkOSPlugin): void {
    if (this.plugins.has(plugin.id)) {
      console.warn(`Plugin with ID ${plugin.id} is already registered. Overwriting.`);
    }
    this.plugins.set(plugin.id, plugin);
    console.log(`Plugin loaded: ${plugin.name} (ID: ${plugin.id})`);
  }

  public getPlugins(): InkOSPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Returns list of Intents registered by plugins that match current gesture + context.
   */
  public getIntentsFor(gesture: GestureType, context: ContextElement): Intent[] {
    const intents: Intent[] = [];

    for (const plugin of this.plugins.values()) {
      for (const supported of plugin.supportedIntents) {
        let matchesContext = supported.context === context.type;
        
        // Custom matching heuristics for specific plugins
        if (plugin.id === 'finance_plugin' && context.type === 'text') {
          // Only show currency conversion if text contains currency symbols
          const text = context.content;
          const hasCurrency = /[\$\€\£\¥\₹]\s*\d+/.test(text) || /\d+\s*(USD|EUR|GBP|JPY|INR)/i.test(text);
          const hasTicker = /\$[A-Z]{2,5}\b/.test(text);
          
          if (supported.intentId === 'convert_currency' && !hasCurrency) continue;
          if (supported.intentId === 'stock_quote' && !hasTicker) continue;
        }

        if (supported.gesture === gesture && matchesContext) {
          intents.push({
            id: `${plugin.id}:${supported.intentId}`,
            label: supported.label,
            description: supported.description,
            score: 0.92, // High priority for specialized plugins
            icon: supported.icon,
            gesture,
            context: context.type
          });
        }
      }
    }

    return intents;
  }

  /**
   * Executes a plugin intent.
   */
  public async executeIntent(pluginIntentId: string, context: ContextElement, gesture: Gesture): Promise<ActionResult> {
    const [pluginId, intentId] = pluginIntentId.split(':');
    const plugin = this.plugins.get(pluginId);
    
    if (!plugin) {
      return { success: false, message: `Plugin ${pluginId} not found.` };
    }

    const supported = plugin.supportedIntents.find(i => i.intentId === intentId);
    if (!supported) {
      return { success: false, message: `Intent ${intentId} not supported by plugin ${pluginId}.` };
    }

    try {
      return await supported.handler(context, gesture);
    } catch (error: any) {
      return { success: false, message: `Error running plugin: ${error.message || error}` };
    }
  }

  // --- SHOWCASE PLUGIN 1: FINANCE ---
  private createFinancePlugin(): InkOSPlugin {
    return {
      id: 'finance_plugin',
      name: 'Finance & Markets',
      description: 'Provides quick currency conversions and real-time market data quotes.',
      supportedIntents: [
        {
          gesture: 'circle',
          context: 'text',
          intentId: 'convert_currency',
          label: 'Convert Currency',
          description: 'Convert currency amount locally',
          icon: '💵',
          handler: async (context: ContextElement) => {
            const text = context.content;
            const match = text.match(/([\$\€\£\¥\₹])\s*(\d+(\.\d+)?)/) || text.match(/(\d+(\.\d+)?)\s*(USD|EUR|GBP|JPY|INR)/i);
            
            if (!match) {
              return { success: false, message: 'Could not extract currency amount.' };
            }

            let amount = 0;
            let symbol = '';
            
            if (isNaN(Number(match[1]))) {
              // Format: $150
              symbol = match[1];
              amount = parseFloat(match[2]);
            } else {
              // Format: 150 USD
              amount = parseFloat(match[1]);
              symbol = match[3].toUpperCase();
            }

            // Rates as of 2026 (approximate conversion helper)
            const conversions: Record<string, { rate: number; name: string; symbol: string }> = {
              '$': { rate: 1.0, name: 'USD', symbol: '$' },
              'USD': { rate: 1.0, name: 'USD', symbol: '$' },
              '€': { rate: 1.09, name: 'EUR', symbol: '€' },
              'EUR': { rate: 1.09, name: 'EUR', symbol: '€' },
              '£': { rate: 1.28, name: 'GBP', symbol: '£' },
              'GBP': { rate: 1.28, name: 'GBP', symbol: '£' },
              '₹': { rate: 0.012, name: 'INR', symbol: '₹' },
              'INR': { rate: 0.012, name: 'INR', symbol: '₹' }
            };

            const source = conversions[symbol] || { rate: 1.0, name: symbol, symbol };
            const amountInUSD = amount * source.rate;

            const eur = (amountInUSD / conversions['EUR'].rate).toFixed(2);
            const gbp = (amountInUSD / conversions['GBP'].rate).toFixed(2);
            const inr = (amountInUSD / conversions['INR'].rate).toFixed(2);
            const usd = amountInUSD.toFixed(2);

            const displayHtml = `
              <div class="finance-card">
                <h4>Currency Conversions for ${source.symbol}${amount}</h4>
                <div class="conversions-grid">
                  <div class="conv-item"><strong>🇺🇸 USD:</strong> $${usd}</div>
                  <div class="conv-item"><strong>🇪🇺 EUR:</strong> €${eur}</div>
                  <div class="conv-item"><strong>🇬🇧 GBP:</strong> £${gbp}</div>
                  <div class="conv-item"><strong>🇮🇳 INR:</strong> ₹${inr}</div>
                </div>
              </div>
            `;

            return {
              success: true,
              data: { amount, source: source.name, usd, eur, gbp, inr },
              displayHtml
            };
          }
        },
        {
          gesture: 'circle',
          context: 'text',
          intentId: 'stock_quote',
          label: 'Get Stock Quote',
          description: 'Fetch real-time stock ticker performance',
          icon: '📈',
          handler: async (context: ContextElement) => {
            const match = context.content.match(/\$([A-Z]{2,5})\b/);
            if (!match) return { success: false, message: 'No ticker symbol found.' };

            const ticker = match[1].toUpperCase();
            
            // Mock stock database
            const mockStocks: Record<string, { name: string; price: number; change: number }> = {
              'AAPL': { name: 'Apple Inc.', price: 182.52, change: 1.24 },
              'TSLA': { name: 'Tesla Motors', price: 210.10, change: -4.32 },
              'GOOGL': { name: 'Alphabet Inc.', price: 174.50, change: 0.85 },
              'MSFT': { name: 'Microsoft Corp.', price: 415.60, change: 2.10 },
              'NVDA': { name: 'NVIDIA Corporation', price: 875.12, change: 5.42 }
            };

            const stock = mockStocks[ticker] || { name: `${ticker} Corp.`, price: 100.00 + Math.random() * 50, change: -5 + Math.random() * 10 };
            const changeClass = stock.change >= 0 ? 'text-green' : 'text-red';
            const changeSign = stock.change >= 0 ? '+' : '';

            const displayHtml = `
              <div class="stock-card">
                <div class="stock-header">
                  <strong>${ticker}</strong>
                  <span>${stock.name}</span>
                </div>
                <div class="stock-price">$${stock.price.toFixed(2)}</div>
                <div class="stock-change ${changeClass}">
                  ${changeSign}${stock.change.toFixed(2)}% (today)
                </div>
                <div class="stock-chart-mock">
                  <svg viewBox="0 0 100 30" class="mini-chart">
                    <path d="M0,20 Q20,${15 - stock.change * 2} 40,18 T80,${10 - stock.change * 2} T100,${5 - stock.change * 3}" 
                          fill="none" stroke="${stock.change >= 0 ? '#10B981' : '#EF4444'}" stroke-width="2" />
                  </svg>
                </div>
              </div>
            `;

            return {
              success: true,
              data: { ticker, ...stock },
              displayHtml
            };
          }
        }
      ]
    };
  }

  // --- SHOWCASE PLUGIN 2: DEVELOPER TOOLBOX ---
  private createDeveloperPlugin(): InkOSPlugin {
    return {
      id: 'developer_plugin',
      name: 'Developer Toolbox',
      description: 'Utilities for software development, code execution, and debugging.',
      supportedIntents: [
        {
          gesture: 'circle',
          context: 'code',
          intentId: 'run_sandbox',
          label: 'Run Javascript Code',
          description: 'Execute JavaScript code block securely',
          icon: '⚡',
          handler: async (context: ContextElement) => {
            const rawCode = context.content;
            
            // Clean code block markdown if present
            const cleanCode = rawCode.replace(/```javascript|```js|```typescript|```ts|```/gi, '').trim();

            let consoleOutput: string[] = [];
            const customConsole = {
              log: (...args: any[]) => {
                consoleOutput.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
              },
              error: (...args: any[]) => {
                consoleOutput.push('🔴 Error: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
              },
              warn: (...args: any[]) => {
                consoleOutput.push('🟡 Warning: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
              }
            };

            try {
              // Create sandboxed evaluator (simple Function binding)
              const runInSandbox = new Function('console', `
                try {
                  ${cleanCode}
                } catch(e) {
                  console.error(e.message || e);
                }
              `);
              
              runInSandbox(customConsole);
              
              if (consoleOutput.length === 0) {
                consoleOutput.push('Code executed successfully. No console output generated.');
              }
            } catch (e: any) {
              consoleOutput.push('🚨 Sandbox compilation error: ' + (e.message || e));
            }

            const displayHtml = `
              <div class="developer-card">
                <h4>JavaScript Sandbox Console</h4>
                <pre class="terminal-output">${consoleOutput.map(line => this.escapeHtml(line)).join('\n')}</pre>
              </div>
            `;

            return {
              success: true,
              data: { output: consoleOutput },
              displayHtml
            };
          }
        }
      ]
    };
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
