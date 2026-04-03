import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw } from 'lucide-react';

export default function DockerNodes() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNodes = async () => {
    try {
      // Use api utility to fetch dockernodes
      const res = await fetch(`${import.meta.env.VITE_API_ORIGIN || ''}/api/dockernodes`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Error fetching nodes');
      setNodes(data);
    } catch (err) {
      console.error('Failed to fetch Docker nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  const handleAction = async (id, action) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_ORIGIN || ''}/api/dockernodes/${id}/${action}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Error executing action');
      }
      fetchNodes(); // Refresh
    } catch (error) {
      alert(`Failed to ${action} container: ` + (error.message || ''));
    }
  };

  return (
    <div className="bg-white/5 rounded-2xl border border-white/10 p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">MT5 Terminal Nodes (Docker)</h2>
        <button 
          onClick={fetchNodes}
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading nodes...</div>
      ) : nodes.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No MT5 nodes found. Ensure your terminal containers include "mt5-node" in their names.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left bg-transparent border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-sm">
                <th className="pb-3 px-4 font-medium">Node Name</th>
                <th className="pb-3 px-4 font-medium">Status</th>
                <th className="pb-3 px-4 font-medium">VNC Port</th>
                <th className="pb-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {nodes.map(node => {
                const vncPort = node.ports?.find(p => p.PrivatePort === 8080)?.PublicPort || 'N/A';
                const isRunning = node.state === 'running';

                return (
                  <tr key={node.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-4 font-medium text-white">
                      {node.name}
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {node.state.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-gray-400">
                      {vncPort !== 'N/A' && isRunning ? (
                        <a href={`http://localhost:${vncPort}/vnc.html`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">
                          :{vncPort}
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        {!isRunning && (
                          <button
                            onClick={() => handleAction(node.id, 'start')}
                            className="p-1.5 text-emerald-400 hover:bg-emerald-400/10 rounded"
                            title="Start Node"
                          >
                            <Play className="w-5 h-5" />
                          </button>
                        )}
                        {isRunning && (
                          <button
                            onClick={() => handleAction(node.id, 'stop')}
                            className="p-1.5 text-red-400 hover:bg-red-400/10 rounded"
                            title="Stop Node"
                          >
                            <Square className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
