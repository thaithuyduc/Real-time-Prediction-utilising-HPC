import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore - react-plotly.js factory path sometimes triggers missing declaration alerts in strict tsconfig
import _createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js-dist-min';
import type { Data, Layout, Config } from 'plotly.js';
// Defensively extract the factory handler to resolve Vite's CommonJS/ESM interop object wrapper
const createPlotlyComponent = (_createPlotlyComponent as any).default || _createPlotlyComponent;
const Plot = createPlotlyComponent(Plotly);

// Ensure your SSEPayload includes the new technical parameters from your backend
interface SSEPayload {
    time: string;
    actual: number;
    next_time: string;
    local_forecast: number;
    // New parameters for the table (update these to match your backend)
    throughput?: number;
    latency?: number;
    cpu_usage?: number;
    memory_usage?: number;
}

export function DashboardCharts() {
    // --- 1. Real-Time State Coordinates ---
    const [actualX, setActualX] = useState<string[]>([]);
    const [actualY, setActualY] = useState<number[]>([]);

    const [localForecastX, setLocalForecastX] = useState<string[]>([]);
    const [localForecastY, setLocalForecastY] = useState<number[]>([]);

    // NEW: State for technical metrics table
    const [metrics, setMetrics] = useState({
        throughput: 0,
        latency: 0,
        cpuUsage: 0,
        memoryUsage: 0,
    });

    // Revision counter to force Plotly canvas updates
    const [revision, setRevision] = useState<number>(0);
    const streamTicks = useRef<number>(0);

    // --- 2. SSE Connection Handling Lifecycle ---
    useEffect(() => {
        console.log("Attempting to connect to Django SSE...");
        const eventSource = new EventSource('http://127.0.0.1:8000/api/stock-stream/');

        eventSource.onopen = () => {
            console.log("✅ SSE Connection successfully established!");
            streamTicks.current = 0; // Reset counter on connection
        };

        eventSource.onmessage = (event) => {
            const data: SSEPayload = JSON.parse(event.data);
            console.log("📥 Live Data Received:", data);

            // Increment our tick reference counter
            streamTicks.current += 1;
            const MAX_HISTORY = 20;

            // Skip the first tick for Actual data so Forecast gets a head start on screen
            if (streamTicks.current > 1) {
                setActualX((prev) => [...prev.slice(-MAX_HISTORY), data.time]);
                setActualY((prev) => [...prev.slice(-MAX_HISTORY), data.actual]);
            }

            // Always update Forecast streams from tick #1
            setLocalForecastX((prev) => [...prev.slice(-MAX_HISTORY), data.next_time]);
            setLocalForecastY((prev) => [...prev.slice(-MAX_HISTORY), data.local_forecast]);

            // Update Table Metrics (Fallback values provided for demonstration)
            setMetrics({
                throughput: data.throughput || 1250,
                latency: data.latency || 42,
                cpuUsage: data.cpu_usage || 68,
                memoryUsage: data.memory_usage || 512,
            });

            // Force Plotly update
            setRevision(prev => prev + 1);
        };

        eventSource.onerror = (err) => {
            console.error("❌ Stock SSE connection error:", err);
            eventSource.close();
        };

        return () => {
            eventSource.close();
        };
    }, []);

    // --- Strict Plotly Layout Configuration ---
    const sharedLayout: Partial<Layout> = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        margin: { l: 40, r: 20, t: 20, b: 40 },
        autosize: true,
        hovermode: 'x unified' as const,
        hoverlabel: { bgcolor: '#1e1b4b', font: { color: '#fff' } },
        datarevision: revision,
        xaxis: {
            gridcolor: 'rgba(255, 255, 255, 0.05)',
            zeroline: false,
            tickfont: { color: '#9ca3af' },
        },
        yaxis: {
            gridcolor: 'rgba(255, 255, 255, 0.05)',
            zeroline: false,
            tickfont: { color: '#9ca3af' },
        },
        legend: {
            orientation: 'h' as const,
            x: 0,
            y: -0.15,
            font: { color: '#9ca3af', size: 12 },
            bgcolor: 'rgba(0,0,0,0)'
        }
    };

    const sharedConfig = {
        responsive: true,
        displayModeBar: false
    };

    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-xl p-md bg-surface-container">
            {/* 1. Local Execution Chart */}
            <div className="relative group p-md bg-surface-container-low rounded-lg border border-outline-variant">
                <div className="h-[400px] w-full">
                    <Plot
                        data={[
                            {
                                x: actualX,
                                y: actualY,
                                type: 'scatter',
                                mode: 'lines+markers',
                                name: 'Actual',
                                line: { color: '#6366F1', width: 3 },
                                marker: { size: 6 }
                            },
                            {
                                x: localForecastX,
                                y: localForecastY,
                                type: 'scatter',
                                mode: 'lines',
                                name: 'Forecast',
                                line: { color: '#d97721', width: 2.5, dash: 'dot' }
                            }
                        ]}
                        layout={sharedLayout}
                        config={sharedConfig}
                        useResizeHandler={true}
                        style={{ width: '100%', height: '100%' }}
                    />
                </div>
            </div>

            {/* 2. Technical Parameters Table */}
            <div className="relative group p-md bg-surface-container-low rounded-lg border border-outline-variant flex flex-col">
                <div className="h-[400px] w-full overflow-y-auto">
                    <h3 className="text-lg font-semibold mb-4 text-gray-200">System Metrics</h3>
                    <table className="min-w-full text-left text-sm text-gray-300">
                        <thead className="bg-white/5 border-b border-gray-600">
                            <tr>
                                <th className="px-4 py-3 font-medium">Metric</th>
                                <th className="px-4 py-3 font-medium">Value</th>
                                <th className="px-4 py-3 font-medium">Unit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            <tr className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">Throughput</td>
                                <td className="px-4 py-3 font-mono text-secondary">{metrics.throughput}</td>
                                <td className="px-4 py-3">req/s</td>
                            </tr>
                            <tr className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">Latency</td>
                                <td className="px-4 py-3 font-mono text-tertiary-container">{metrics.latency}</td>
                                <td className="px-4 py-3">ms</td>
                            </tr>
                            <tr className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">CPU Usage</td>
                                <td className="px-4 py-3 font-mono">{metrics.cpuUsage}</td>
                                <td className="px-4 py-3">%</td>
                            </tr>
                            <tr className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3">Memory Allocation</td>
                                <td className="px-4 py-3 font-mono">{metrics.memoryUsage}</td>
                                <td className="px-4 py-3">MB</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export function StockForecast() {
    const [timeframe, setTimeframe] = useState('1H');
    const [searchQuery, setSearchQuery] = useState('');

    const timeframes = ['1H', '6H', '1D', '7D', '30D'];

    return (
        <div className="flex flex-col min-h-screen bg-[#13131b] text-[#e4e1ed] font-sans overflow-x-hidden selection:bg-primary-container selection:text-on-primary-container">
            {/* Custom Styles for faithful replication of charts and scrollbars */}
            <style>{`
            .glass-panel {
                background: rgba(27, 27, 35, 0.6);
                backdrop-filter: blur(12px);
                border: 1px solid #2D313E;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .glass-panel:hover {
                border-color: #6366F1;
            }
            .material-symbols-outlined {
                font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
            }
            .custom-scrollbar::-webkit-scrollbar {
                width: 4px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: #13131b;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: #2D313E;
                border-radius: 10px;
            }
            `}</style>

            {/* Main Wrapper */}
            <main className="flex-1 flex flex-col min-w-0">
                {/* TopAppBar */}
                <header className="flex justify-between items-center px-lg py-sm w-full z-50 bg-surface border-b border-outline-variant sticky top-0">
                    <div className="flex items-center gap-md">
                        <h3 className="font-h3 text-h3 font-extrabold text-primary">Stock Forecast</h3>
                        <div className="h-6 w-px bg-outline-variant"></div>
                        <div className="flex items-center gap-sm bg-surface-container px-sm py-xs rounded-full border border-outline-variant">
                            <span className="material-symbols-outlined text-[18px] text-secondary">memory</span>
                            <span className="text-label-md font-mono text-secondary">CLUSTER ACTIVE</span>
                        </div>
                        <nav className="hidden lg:flex items-center gap-md ml-lg">
                            <a className="text-primary font-bold text-label-md hover:underline" href="#">
                                Overview
                            </a>
                            <a
                                className="text-on-surface-variant hover:text-on-surface text-label-md transition-colors hover:underline"
                                href="#"
                            >
                                History
                            </a>
                            <a
                                className="text-on-surface-variant hover:text-on-surface text-label-md transition-colors hover:underline"
                                href="#"
                            >
                                Nodes
                            </a>
                        </nav>
                    </div>
                    <div className="flex items-center gap-md">
                        <div className="hidden md:flex items-center bg-surface-container rounded-lg px-sm py-xs border border-outline-variant w-72">
                            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">search</span>
                            <input
                                className="bg-transparent border-none focus:ring-0 text-body-sm w-full placeholder:text-on-surface-variant/50 outline-none text-on-surface ml-2"
                                placeholder="Search data points..."
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-sm">
                            <button className="p-xs text-on-surface-variant hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">notifications</span>
                            </button>
                            <button className="p-xs text-on-surface-variant hover:text-primary transition-colors">
                                <span className="material-symbols-outlined">settings</span>
                            </button>
                        </div>
                        <img
                            alt="User Profile"
                            className="w-8 h-8 rounded-full border border-outline"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDZNrqShizUGwO5_W-BFpOMzRvKvl42gCuf5JHA7yG3R2lReRm_2cwfB87uFhIlas5-3QNnh70HqVy70wsgw8lgK4u8Nef4x3cXWLZ7Dp2_jnfyisPmyk8uPqFnwPsQOBeUaGdoAChH_YSZBUuFPecHnsXdVbn-WZdCoQYQh76EWsKHlOvCk2CFIYQDKAIsmXrjYElgl8dmBCFarAuqPmFaxnJV7kD5VX9g7qLaMaUWyzS28bPkYI2xpW8edNO6XWLxwoWiU6Y37Oo"
                        />
                    </div>
                </header>

                {/* Cluster Summary Cards (Sub-Header) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-md px-lg py-md bg-surface-container-lowest">
                    <div className="glass-panel p-md rounded-xl flex flex-col gap-xs">
                        <span className="text-on-surface-variant font-label-md">Total Nodes</span>
                        <div className="flex items-center gap-sm">
                            <span className="font-h3 text-h3 text-on-surface">04</span>
                            <span className="text-secondary text-[16px] font-bold">Online</span>
                        </div>
                    </div>
                    <div className="glass-panel p-md rounded-xl flex flex-col gap-xs">
                        <span className="text-on-surface-variant font-label-md">Active Replicas</span>
                        <div className="flex items-center gap-sm">
                            <span className="font-h3 text-h3 text-on-surface">12</span>
                            <span className="text-secondary text-[16px] font-bold">Healthy</span>
                        </div>
                    </div>
                    <div className="glass-panel p-md rounded-xl flex flex-col gap-xs">
                        <span className="text-on-surface-variant font-label-md">Avg Latency</span>
                        <div className="flex items-center gap-sm">
                            <span className="font-h3 text-h3 text-on-surface">14ms</span>
                            <span className="text-secondary text-[16px] font-bold">Stable</span>
                        </div>
                    </div>
                    {/* <div className="glass-panel p-md rounded-xl flex flex-col gap-xs">
                        <span className="text-on-surface-variant font-label-md">Requests/sec</span>
                        <div className="flex items-center gap-sm">
                            <span className="font-h3 text-h3 text-on-surface">840</span>
                            <span className="text-error text-[16px] font-bold">Peak</span>
                        </div>
                    </div> */}
                    <div className="glass-panel p-md rounded-xl flex flex-col gap-xs">
                        <span className="text-on-surface-variant font-label-md">Containers</span>
                        <div className="flex items-center gap-sm">
                            <span className="font-h3 text-h3 text-on-surface">16</span>
                            <span className="text-secondary text-[16px] font-bold">Scaling</span>
                        </div>
                    </div>
                </div>

                {/* Canvas Content */}
                <div className="px-lg py-md space-y-md">
                    {/* Main Content Area - Full width prediction section */}
                    <div className="glass-panel rounded-xl p-lg min-h-[600px] flex flex-col">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-md mb-xl">
                            <div>
                                <h2 className="font-h2 text-h2 text-on-surface">Real-Time Stock Prediction</h2>
                                <p className="text-body-md text-on-surface-variant">
                                    Comparing Distributed Forecast vs Local Inference across full cluster bandwidth
                                </p>
                            </div>
                            <div className="flex p-xs bg-surface-container-high rounded-lg gap-xs">
                                {timeframes.map((tf) => (
                                    <button
                                        key={tf}
                                        className={`px-md py-sm text-label-md rounded-md transition-colors ${timeframe === tf
                                                ? 'bg-surface-container-highest text-primary'
                                                : 'text-on-surface-variant hover:text-on-surface'
                                            }`}
                                        onClick={() => setTimeframe(tf)}
                                    >
                                        {tf}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <DashboardCharts />
                    </div>

                    {/* Inference Latency Timeline */}
                    <div className="mt-lg pt-lg border-t border-outline-variant">
                        <div className="flex items-center justify-between mb-lg">
                            <h3 className="text-label-md font-label-md text-on-surface-variant uppercase tracking-widest">
                                Inference Latency Comparison Timeline (ms)
                            </h3>
                            <div className="flex gap-md">
                                <div className="flex items-center gap-xs">
                                    <span className="w-2 h-0.5 bg-tertiary-container"></span>
                                    <span className="text-[10px] text-on-surface-variant">Local</span>
                                </div>
                                <div className="flex items-center gap-xs">
                                    <span className="w-2 h-0.5 bg-secondary"></span>
                                    <span className="text-[10px] text-on-surface-variant">Distributed</span>
                                </div>
                            </div>
                        </div>
                        <div className="h-48 w-full glass-panel rounded-lg p-md relative overflow-hidden">
                            <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 100">
                                {/* Local Latency Line */}
                                <polyline
                                    fill="none"
                                    points="0,40 100,45 200,38 300,50 400,42 500,48 600,35 700,52 800,44 900,55 1000,40"
                                    stroke="#d97721"
                                    strokeWidth="2"
                                ></polyline>
                                {/* Distributed Latency Line */}
                                <polyline
                                    fill="none"
                                    points="0,90 100,92 200,89 300,91 400,90 500,92 600,91 700,89 800,90 900,91 1000,90"
                                    stroke="#4edea3"
                                    strokeWidth="2"
                                ></polyline>
                            </svg>
                            <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20 text-[10px] font-mono">
                                <div className="border-t border-outline-variant w-full pt-1">200ms</div>
                                <div className="border-t border-outline-variant w-full pt-1">100ms</div>
                                <div className="border-t border-outline-variant w-full pt-1">0ms</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Monitoring Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-md px-lg pb-xl">
                    {/* Node Utilisation Table */}
                    <div className="glass-panel rounded-xl p-md overflow-x-auto">
                        <h2 className="font-h3 text-h3 text-on-surface mb-md">Node Utilisation</h2>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-outline-variant text-on-surface-variant font-label-md">
                                    <th className="py-sm">Node</th>
                                    <th className="py-sm">CPU%</th>
                                    <th className="py-sm">RAM%</th>
                                    <th className="py-sm">Network</th>
                                    <th className="py-sm">Status</th>
                                </tr>
                            </thead>
                            <tbody className="text-body-sm">
                                <tr className="border-b border-outline-variant/30">
                                    <td className="py-sm font-mono text-primary">manager-01</td>
                                    <td className="py-sm">
                                        <div className="w-24 h-2 bg-surface-container-high rounded-full">
                                            <div className="h-full bg-secondary rounded-full" style={{ width: '24%' }}></div>
                                        </div>
                                    </td>
                                    <td className="py-sm">
                                        <div className="w-24 h-2 bg-surface-container-high rounded-full">
                                            <div className="h-full bg-secondary rounded-full" style={{ width: '42%' }}></div>
                                        </div>
                                    </td>
                                    <td className="py-sm text-on-surface-variant">1.2 Gbps</td>
                                    <td className="py-sm text-secondary">Healthy</td>
                                </tr>
                                <tr className="border-b border-outline-variant/30">
                                    <td className="py-sm font-mono text-primary">worker-01</td>
                                    <td className="py-sm">
                                        <div className="w-24 h-2 bg-surface-container-high rounded-full">
                                            <div className="h-full bg-tertiary-container rounded-full" style={{ width: '78%' }}></div>
                                        </div>
                                    </td>
                                    <td className="py-sm">
                                        <div className="w-24 h-2 bg-surface-container-high rounded-full">
                                            <div className="h-full bg-secondary rounded-full" style={{ width: '61%' }}></div>
                                        </div>
                                    </td>
                                    <td className="py-sm text-on-surface-variant">840 Mbps</td>
                                    <td className="py-sm text-secondary">Active</td>
                                </tr>
                                <tr>
                                    <td className="py-sm font-mono text-primary">worker-02</td>
                                    <td className="py-sm">
                                        <div className="w-24 h-2 bg-surface-container-high rounded-full">
                                            <div className="h-full bg-error rounded-full" style={{ width: '92%' }}></div>
                                        </div>
                                    </td>
                                    <td className="py-sm">
                                        <div className="w-24 h-2 bg-surface-container-high rounded-full">
                                            <div className="h-full bg-tertiary-container rounded-full" style={{ width: '82%' }}></div>
                                        </div>
                                    </td>
                                    <td className="py-sm text-on-surface-variant">910 Mbps</td>
                                    <td className="py-sm text-error">Warning</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Replica Distribution Table */}
                    <div className="glass-panel rounded-xl p-md overflow-x-auto">
                        <div className="flex justify-between items-center mb-md">
                            <h2 className="font-h3 text-h3 text-on-surface">Replica Distribution</h2>
                        </div>
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-outline-variant text-on-surface-variant font-label-md">
                                    <th className="py-sm">Node</th>
                                    <th className="py-sm">Active Replicas</th>
                                </tr>
                            </thead>
                            <tbody className="text-body-sm">
                                <tr className="border-b border-outline-variant/30">
                                    <td className="py-sm font-mono text-primary align-top">Manager</td>
                                    <td className="py-sm">
                                        <div className="flex flex-wrap gap-xs">
                                            <span className="px-sm py-0.5 bg-surface-container-highest text-secondary border border-secondary/20 rounded-full text-[11px] font-medium">
                                                preprocessor
                                            </span>
                                            <span className="px-sm py-0.5 bg-surface-container-highest text-secondary border border-secondary/20 rounded-full text-[11px] font-medium">
                                                dashboard
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr className="border-b border-outline-variant/30">
                                    <td className="py-sm font-mono text-primary align-top">Worker-1</td>
                                    <td className="py-sm">
                                        <div className="flex flex-wrap gap-xs">
                                            <span className="px-sm py-0.5 bg-surface-container-highest text-on-surface border border-outline-variant rounded-full text-[11px] font-medium">
                                                lstm-api replica 1
                                            </span>
                                            <span className="px-sm py-0.5 bg-surface-container-highest text-on-surface border border-outline-variant rounded-full text-[11px] font-medium">
                                                lstm-api replica 2
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr className="border-b border-outline-variant/30">
                                    <td className="py-sm font-mono text-primary align-top">Worker-2</td>
                                    <td className="py-sm">
                                        <div className="flex flex-wrap gap-xs">
                                            <span className="px-sm py-0.5 bg-surface-container-highest text-on-surface border border-outline-variant rounded-full text-[11px] font-medium">
                                                lstm-api replica 3
                                            </span>
                                            <span className="px-sm py-0.5 bg-surface-container-highest text-tertiary border border-tertiary/20 rounded-full text-[11px] font-medium">
                                                ingestion
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="py-sm font-mono text-primary align-top">Worker-3</td>
                                    <td className="py-sm">
                                        <div className="flex flex-wrap gap-xs">
                                            <span className="px-sm py-0.5 bg-surface-container-highest text-on-surface border border-outline-variant rounded-full text-[11px] font-medium">
                                                lstm-api replica 4
                                            </span>
                                            <span className="px-sm py-0.5 bg-surface-container-highest text-tertiary border border-tertiary/20 rounded-full text-[11px] font-medium">
                                                ingestion
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
