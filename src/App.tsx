import { useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  CloudUpload,
  Copy,
  Database,
  Layers3,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
} from 'lucide-react';

// --- Example datasets & tools ---
const AVAILABLE_DATASETS = [
  { id: 'ds-products', name: 'Product Catalog' },
  { id: 'ds-support', name: 'Support Articles' },
  { id: 'ds-usage', name: 'Usage Analytics' },
  { id: 'ds-policies', name: 'Company Policies' },
];

const AVAILABLE_TOOLS = [
  { id: 'tool-search', name: 'Knowledge Search' },
  { id: 'tool-summary', name: 'Document Summarizer' },
  { id: 'tool-reporting', name: 'Report Generator' },
  { id: 'tool-calculator', name: 'Calculation Service' },
];

export default function App() {
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  
  const [selectedDatasets, setSelectedDatasets] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState<number>(-1);
  const [deployResult, setDeployResult] = useState<{ url: string; snippet: string } | null>(null);

  const handleDatasetToggle = (id: string) => {
    setSelectedDatasets(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToolToggle = (id: string) => {
    setSelectedTools(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeploy = async () => {
    if (!agentName || selectedDatasets.length === 0 || selectedTools.length === 0) return;
    
    setIsDeploying(true);
    setDeployStep(0);
    setDeployResult(null);
    
    // Simulate early frontend pipeline steps
    setTimeout(() => setDeployStep(1), 600); // Saving config
    setTimeout(() => setDeployStep(2), 1500); // Provisioning runtime
    
    try {
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName,
          description: agentDescription,
          datasets: selectedDatasets,
          tools: selectedTools
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setDeployStep(3); // Verifying endpoint
        setTimeout(() => {
          setDeployResult({
            url: data.url,
            snippet: data.snippet,
          });
          setIsDeploying(false);
          setDeployStep(-1);
        }, 1200);
      } else {
        console.error('Deployment failed from server:', data.error);
        alert('Deployment failed. Check console for details.');
        setIsDeploying(false);
        setDeployStep(-1);
      }
    } catch (error) {
      console.error('Error during deployment:', error);
      alert('An error occurred during deployment.');
      setIsDeploying(false);
      setDeployStep(-1);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="console-shell min-h-screen px-4 py-6 text-zinc-300 sm:px-6 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between border-b border-white/[0.07] pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300">
              <Bot size={21} />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-zinc-100">Agent Console</p>
              <p className="text-xs text-zinc-500">Workspace deployment</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
            Prototype
          </div>
        </header>

        <div className="mb-8 max-w-3xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">
            <Sparkles size={14} />
            Agent workspace
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Create an agent</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
            Define your agent, choose the resources it can use, and deploy a ready-to-connect API.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8">
          <div className="space-y-5">
            <section className="console-card p-5 sm:p-7">
              <div className="mb-6 flex items-start gap-4">
                <div className="section-icon"><Settings size={18} /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">Agent identity</h2>
                    <span className="section-number">01</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">Give your agent a name and a clear purpose.</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="field-label">
                    Agent name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Support Assistant"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    className="console-input"
                  />
                </div>
                <div>
                  <label className="field-label">Agent description</label>
                  <textarea
                    placeholder="What should this agent help with?"
                    value={agentDescription}
                    onChange={(e) => setAgentDescription(e.target.value)}
                    rows={3}
                    className="console-input resize-none"
                  />
                </div>
              </div>
            </section>

            <section className="console-card p-5 sm:p-7">
              <div className="mb-6 flex items-start gap-4">
                <div className="section-icon"><Database size={18} /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">Datasets</h2>
                    <span className="section-number">02</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">Choose the information available to this agent.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {AVAILABLE_DATASETS.map((ds, index) => (
                  <label key={ds.id} className="choice-card">
                    <input
                      type="checkbox"
                      checked={selectedDatasets.includes(ds.id)}
                      onChange={() => handleDatasetToggle(ds.id)}
                      className="choice-checkbox"
                    />
                    <span className="choice-icon"><Database size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-200">{ds.name}</span>
                      <span className="mt-1 block text-xs text-zinc-500">Example data source {String(index + 1).padStart(2, '0')}</span>
                    </span>
                    <span className="choice-indicator"><CheckCircle2 size={15} /></span>
                  </label>
                ))}
              </div>
            </section>

            <section className="console-card p-5 sm:p-7">
              <div className="mb-6 flex items-start gap-4">
                <div className="section-icon"><Wrench size={18} /></div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold text-white">Tools</h2>
                    <span className="section-number">03</span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">Choose the capabilities available to this agent.</p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {AVAILABLE_TOOLS.map((tool, index) => (
                  <label key={tool.id} className="choice-card">
                    <input
                      type="checkbox"
                      checked={selectedTools.includes(tool.id)}
                      onChange={() => handleToolToggle(tool.id)}
                      className="choice-checkbox"
                    />
                    <span className="choice-icon"><Wrench size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-200">{tool.name}</span>
                      <span className="mt-1 block text-xs text-zinc-500">Example tool {String(index + 1).padStart(2, '0')}</span>
                    </span>
                    <span className="choice-indicator"><CheckCircle2 size={15} /></span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-8">
            <section className="console-card overflow-hidden">
              <div className="border-b border-white/[0.07] p-5 sm:p-6">
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="section-icon"><Layers3 size={18} /></div>
                    <div>
                      <h2 className="text-base font-semibold text-white">Configuration</h2>
                      <p className="mt-1 text-sm text-zinc-500">Review before deployment.</p>
                    </div>
                  </div>
                  <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Draft</span>
                </div>

                <div className="space-y-4">
                  <div className="summary-block">
                    <span className="summary-label">Agent name</span>
                    <span className={`summary-value ${!agentName ? 'italic text-zinc-600' : ''}`}>{agentName || 'Not set'}</span>
                  </div>
                  <div className="summary-block">
                    <div className="flex items-center justify-between">
                      <span className="summary-label">Datasets</span>
                      <span className="summary-count">{selectedDatasets.length} selected</span>
                    </div>
                    <span className={`summary-value ${selectedDatasets.length === 0 ? 'italic text-zinc-600' : ''}`}>
                      {selectedDatasets.length > 0
                        ? selectedDatasets.map(id => AVAILABLE_DATASETS.find(d => d.id === id)?.name).join(', ')
                        : 'None selected'}
                    </span>
                  </div>
                  <div className="summary-block">
                    <div className="flex items-center justify-between">
                      <span className="summary-label">Tools</span>
                      <span className="summary-count">{selectedTools.length} selected</span>
                    </div>
                    <span className={`summary-value ${selectedTools.length === 0 ? 'italic text-zinc-600' : ''}`}>
                      {selectedTools.length > 0
                        ? selectedTools.map(id => AVAILABLE_TOOLS.find(t => t.id === id)?.name).join(', ')
                        : 'None selected'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {!deployResult ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <Activity size={14} className="text-emerald-400" />
                      <span>Deployment target</span>
                      <span className="ml-auto text-zinc-300">Cloud Run</span>
                    </div>
                    <button
                      onClick={handleDeploy}
                      disabled={isDeploying || !agentName || selectedDatasets.length === 0 || selectedTools.length === 0}
                      className="deploy-button"
                    >
                      {isDeploying ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                          Deploying agent
                        </>
                      ) : (
                        <>
                          <CloudUpload size={17} />
                          Deploy agent
                          <ArrowUpRight size={16} className="ml-auto opacity-70" />
                        </>
                      )}
                    </button>
                    {!isDeploying && (
                      <p className="text-center text-xs leading-5 text-zinc-500">
                        Add a name, at least one dataset, and at least one tool to deploy.
                      </p>
                    )}
                    {isDeploying && (
                      <div className="deploy-progress">
                        <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                          <Activity size={14} className="text-emerald-400" />
                          Deployment progress
                        </div>
                        <div className="space-y-3">
                          {['Validating config', 'Saving config', 'Provisioning runtime', 'Verifying endpoint'].map((stepName, index) => {
                            const isActive = deployStep === index;
                            const isPast = deployStep > index;
                            return (
                              <div key={stepName} className="flex items-center gap-3">
                                {isPast ? (
                                  <div className="progress-complete"><CheckCircle2 size={13} /></div>
                                ) : isActive ? (
                                  <div className="h-4 w-4 rounded-full border-2 border-zinc-700 border-t-emerald-400 animate-spin" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border border-zinc-800 bg-[#0a0c0b]" />
                                )}
                                <span className={`text-xs ${isActive ? 'font-medium text-white' : isPast ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                  {stepName}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="mb-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
                      <div className="flex items-center gap-2 text-emerald-300">
                        <CheckCircle2 size={17} />
                        <span className="text-sm font-semibold">Successfully deployed</span>
                      </div>
                      <p className="mt-1 pl-6 text-xs text-emerald-100/50">Your agent is ready to receive requests.</p>
                    </div>
                    <div className="space-y-3">
                      <label className="text-xs font-medium uppercase tracking-wider text-zinc-500">API connection snippet</label>
                      <div className="relative group">
                        <pre className="overflow-x-auto rounded-xl border border-white/[0.08] bg-[#090b0a] p-4 pr-12 text-xs leading-5 text-emerald-200/90 font-mono">
                          {deployResult.snippet}
                        </pre>
                        <button
                          onClick={() => copyToClipboard(deployResult.snippet)}
                          className="absolute right-2 top-2 rounded-lg border border-white/[0.08] bg-zinc-800 p-2 text-zinc-400 transition-colors hover:text-white"
                          title="Copy to clipboard"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                      <div className="flex items-start gap-2 rounded-lg border border-amber-300/10 bg-amber-300/[0.04] p-3 text-xs leading-5 text-zinc-500">
                        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-amber-200/60" />
                        <span>For production, authenticate requests using a service account or API key.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <div className="flex items-start gap-3 px-1 text-xs leading-5 text-zinc-600">
              <Sparkles size={14} className="mt-0.5 shrink-0 text-emerald-500/60" />
              <p>Configuration can be reviewed here before each deployment.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
