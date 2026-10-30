import React, { useState, useEffect } from 'react';
import {
  Server,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Plus,
  Trash2,
  ArrowRightLeft,
  Settings2,
  ShieldAlert,
  Play,
  Film,
  Activity,
  Key,
  Globe,
  Sliders,
  History,
  Info,
  X,
  Lock,
} from 'lucide-react';
import { AuthorizedUser } from '../types';
import { formatBytes } from '../services/storageService';
import {
  StorageServer,
  StorageSettings,
  StorageAuditLog,
  StreamoraVideoRecord,
  fetchStorageServers,
  addStorageServer,
  updateStorageServer,
  deleteStorageServer,
  testStorageServerConnection,
  migrateStorageServerVideos,
  fetchStorageSettings,
  updateStorageSettings,
  fetchAuditLogs,
  fetchPersistentVideos,
  deletePersistentVideo,
} from '../services/streamoraVideoService';

interface StorageServersModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthorizedUser;
  onVideosUpdated?: () => void;
}

type ModalTab = 'servers' | 'settings' | 'videos' | 'logs';

export const StorageServersModal: React.FC<StorageServersModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onVideosUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<ModalTab>('servers');
  const [servers, setServers] = useState<StorageServer[]>([]);
  const [settings, setSettings] = useState<StorageSettings>({
    selectionMode: 'automatic',
    defaultServerId: '',
    autoDistributionStrategy: 'priority',
  });
  const [videos, setVideos] = useState<StreamoraVideoRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<StorageAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Testing & Action States
  const [testingServerId, setTestingServerId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; latencyMs: number }>>({});

  // Add / Edit Server Modal State
  const [isEditingServer, setIsEditingServer] = useState<StorageServer | null>(null);
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [serverFormData, setServerFormData] = useState<Partial<StorageServer>>({
    name: '',
    provider: 'media_cm',
    enabled: true,
    isDefault: false,
    priority: 80,
    capacityBytes: 10 * 1024 * 1024 * 1024 * 1024,
    uploadLimitBytes: 300 * 1024 * 1024,
    endpoint: 'https://media.cm',
    accountUrl: 'https://media.cm/?op=my_files',
    websiteUrl: 'https://media.cm/',
    apiKey: '',
  });

  // Migration Modal State
  const [migrationSourceServer, setMigrationSourceServer] = useState<StorageServer | null>(null);
  const [migrationTargetServerId, setMigrationTargetServerId] = useState<string>('');
  const [isMigrating, setIsMigrating] = useState(false);

  // Video Preview State
  const [previewVideo, setPreviewVideo] = useState<StreamoraVideoRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAllData();
    }
  }, [isOpen]);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const [serverList, storageSettings, videoList, logs] = await Promise.all([
        fetchStorageServers(currentUser.email).catch(() => []),
        fetchStorageSettings(currentUser.email).catch(() => ({
          selectionMode: 'automatic' as const,
          defaultServerId: '',
          autoDistributionStrategy: 'priority' as const,
        })),
        fetchPersistentVideos({ all: true }).catch(() => []),
        fetchAuditLogs(currentUser.email).catch(() => []),
      ]);
      setServers(serverList);
      setSettings(storageSettings);
      setVideos(videoList);
      setAuditLogs(logs);
    } catch (err: any) {
      setFeedbackMessage({ text: err.message || 'Error loading storage data', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const showFeedback = (text: string, type: 'success' | 'error') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 5000);
  };

  const handleTestConnection = async (serverId: string) => {
    setTestingServerId(serverId);
    try {
      const res = await testStorageServerConnection(serverId, currentUser.email);
      setTestResults((prev) => ({ ...prev, [serverId]: res }));
      showFeedback(res.message, res.success ? 'success' : 'error');
      // Refresh server list to show updated health status
      const updated = await fetchStorageServers(currentUser.email);
      setServers(updated);
    } catch (err: any) {
      showFeedback(err.message || 'Connection test failed', 'error');
    } finally {
      setTestingServerId(null);
    }
  };

  const handleToggleEnabled = async (server: StorageServer) => {
    try {
      const updated = await updateStorageServer(
        server.id,
        { enabled: !server.enabled },
        currentUser.email
      );
      setServers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      showFeedback(`Server '${server.name}' ${updated.enabled ? 'enabled' : 'disabled'}.`, 'success');
    } catch (err: any) {
      showFeedback(err.message || 'Failed to update server status', 'error');
    }
  };

  const handleSetDefault = async (serverId: string) => {
    try {
      const updated = await updateStorageServer(serverId, { isDefault: true }, currentUser.email);
      setServers((prev) =>
        prev.map((s) => ({
          ...s,
          isDefault: s.id === updated.id,
        }))
      );
      setSettings((prev) => ({ ...prev, defaultServerId: serverId }));
      showFeedback(`Default upload destination set to '${updated.name}'.`, 'success');
    } catch (err: any) {
      showFeedback(err.message || 'Failed to set default server', 'error');
    }
  };

  const handleDeleteServer = async (server: StorageServer) => {
    if (!window.confirm(`Are you sure you want to delete storage server '${server.name}'?`)) return;
    try {
      const res = await deleteStorageServer(server.id, currentUser.email);
      showFeedback(res.message, 'success');
      setServers((prev) => prev.filter((s) => s.id !== server.id));
    } catch (err: any) {
      showFeedback(err.message || 'Failed to delete server.', 'error');
    }
  };

  const handleSaveServer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingServer) {
        const updated = await updateStorageServer(isEditingServer.id, serverFormData, currentUser.email);
        setServers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        showFeedback(`Storage server '${updated.name}' updated successfully.`, 'success');
        setIsEditingServer(null);
      } else {
        const created = await addStorageServer(serverFormData, currentUser.email);
        setServers((prev) => [...prev, created]);
        showFeedback(`Storage server '${created.name}' registered successfully.`, 'success');
        setIsAddingServer(false);
      }
      loadAllData();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to save server.', 'error');
    }
  };

  const handleStartMigration = async () => {
    if (!migrationSourceServer || !migrationTargetServerId) return;
    setIsMigrating(true);
    try {
      const res = await migrateStorageServerVideos(
        migrationSourceServer.id,
        migrationTargetServerId,
        currentUser.email
      );
      showFeedback(res.message, 'success');
      setMigrationSourceServer(null);
      setMigrationTargetServerId('');
      loadAllData();
      onVideosUpdated?.();
    } catch (err: any) {
      showFeedback(err.message || 'Migration failed.', 'error');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const updated = await updateStorageSettings(settings, currentUser.email);
      setSettings(updated);
      showFeedback('Storage routing settings saved successfully.', 'success');
    } catch (err: any) {
      showFeedback(err.message || 'Failed to save settings.', 'error');
    }
  };

  const handleDeleteVideo = async (videoId: string, fileName: string) => {
    if (!window.confirm(`Permanently remove video '${fileName}' from storage?`)) return;
    try {
      await deletePersistentVideo(videoId, currentUser.email);
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      showFeedback(`Video '${fileName}' removed.`, 'success');
      loadAllData();
      onVideosUpdated?.();
    } catch (err: any) {
      showFeedback(err.message || 'Failed to delete video.', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="storage-servers-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl bg-[#0b0f19] border border-rose-500/30 rounded-3xl p-5 sm:p-8 shadow-2xl text-slate-200 max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <Server className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="storage-servers-title" className="text-xl font-bold text-white tracking-tight">
                  Storage Servers Management
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure object storage destinations: Everly Cloud Storage, Media.cm Video Cloud, Fast Local Disk, and S3-Compatible providers.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close storage modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback alert message */}
        {feedbackMessage && (
          <div
            className={`mt-4 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shrink-0 ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
            }`}
          >
            <span>{feedbackMessage.text}</span>
            <button onClick={() => setFeedbackMessage(null)} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex items-center gap-2 mt-4 pb-2 border-b border-white/5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('servers')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'servers'
                ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Storage Servers ({servers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Routing & Settings</span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'videos'
                ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Admin Video Library ({videos.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Audit Logs ({auditLogs.length})</span>
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={loadAllData}
              disabled={isLoading}
              title="Refresh all storage status"
              className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setServerFormData({
                  name: '',
                  provider: 'media_cm',
                  enabled: true,
                  isDefault: false,
                  priority: 80,
                  capacityBytes: 10 * 1024 * 1024 * 1024 * 1024,
                  uploadLimitBytes: 300 * 1024 * 1024,
                  endpoint: 'https://media.cm',
                  accountUrl: 'https://media.cm/?op=my_files',
                  websiteUrl: 'https://media.cm/',
                  apiKey: '',
                });
                setIsAddingServer(true);
              }}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Server</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Storage Servers List */}
        {activeTab === 'servers' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-4 pr-1">
            {servers.map((server) => {
              const isMediaCm = server.provider === 'media_cm';
              const isEverly = server.provider === 'everly_drive';
              const isTesting = testingServerId === server.id;
              const hasTestResult = testResults[server.id];
              const isConfigRequired =
                server.healthStatus === 'degraded' ||
                server.healthMessage?.includes('Configuration required') ||
                (isMediaCm && !server.apiKey);

              return (
                <div
                  key={server.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    server.enabled
                      ? 'bg-[#121727] border-white/10 hover:border-rose-500/30'
                      : 'bg-[#0d111d] border-white/5 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2.5 rounded-xl shrink-0 ${
                          isMediaCm
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : isEverly
                            ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}
                      >
                        {isMediaCm ? (
                          <Globe className="w-5 h-5" />
                        ) : isEverly ? (
                          <HardDrive className="w-5 h-5" />
                        ) : (
                          <Server className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-white">{server.name}</h3>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white/5 text-slate-300 border border-white/10">
                            {server.provider}
                          </span>
                          {server.isDefault && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              DEFAULT DESTINATION
                            </span>
                          )}
                          {!server.enabled && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                              DISABLED
                            </span>
                          )}
                        </div>

                        {/* Health status badge */}
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                          {isConfigRequired ? (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              Configuration required
                            </span>
                          ) : server.healthStatus === 'healthy' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Online & Healthy
                            </span>
                          ) : server.healthStatus === 'unhealthy' ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-medium">
                              <XCircle className="w-3.5 h-3.5" />
                              Offline / Error
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                              <Activity className="w-3.5 h-3.5" />
                              Untested
                            </span>
                          )}

                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">
                            Upload Health: <strong className={server.uploadHealth === 'healthy' ? 'text-emerald-400' : 'text-amber-400'}>{server.uploadHealth || 'healthy'}</strong>
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">
                            Playback Health: <strong className={server.playbackHealth === 'healthy' ? 'text-emerald-400' : 'text-amber-400'}>{server.playbackHealth || 'healthy'}</strong>
                          </span>
                          <span className="text-slate-500">·</span>
                          <span className="text-slate-400">Priority: <strong>{server.priority}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Server Action Buttons */}
                    <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={() => handleTestConnection(server.id)}
                        disabled={isTesting}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                        <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                      </button>

                      <button
                        onClick={() => handleToggleEnabled(server)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors cursor-pointer ${
                          server.enabled
                            ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {server.enabled ? 'Disable' : 'Enable'}
                      </button>

                      {!server.isDefault && server.enabled && (
                        <button
                          onClick={() => handleSetDefault(server.id)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Set Default
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setIsEditingServer(server);
                          setServerFormData({ ...server });
                        }}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Edit server configuration"
                      >
                        <Settings2 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => setMigrationSourceServer(server)}
                        className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        title="Safely migrate videos to another server"
                      >
                        <ArrowRightLeft className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteServer(server)}
                        className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                        title="Delete server (safe migration required if videos exist)"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Media.cm Configuration Required banner */}
                  {isMediaCm && isConfigRequired && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Key className="w-4 h-4 shrink-0 text-amber-400" />
                        <span>
                          <strong>Configuration required:</strong> Media.cm requires an API key for authorized uploads. Go to your Media.cm account to copy your key.
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href="https://media.cm/?op=my_files"
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 font-semibold flex items-center gap-1 transition-colors"
                        >
                          <span>Get API Key</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                        <button
                          onClick={() => {
                            setIsEditingServer(server);
                            setServerFormData({ ...server });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors cursor-pointer"
                        >
                          Enter Key
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Server Stats & Capacity Bar */}
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-4 gap-2 pt-3 border-t border-white/5 text-xs text-slate-400">
                    <div>
                      <span className="text-slate-500">Stored Videos: </span>
                      <strong className="text-white">{server.storedVideoCount || 0}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Capacity Used: </span>
                      <strong className="text-white">{formatBytes(server.usedBytes || 0)}</strong> / {formatBytes(server.capacityBytes || 0)}
                    </div>
                    <div>
                      <span className="text-slate-500">Per-File Limit: </span>
                      <strong className="text-white">{formatBytes(server.uploadLimitBytes || 0)}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Last Upload: </span>
                      <strong className="text-white">
                        {server.lastSuccessfulUploadAt
                          ? new Date(server.lastSuccessfulUploadAt).toLocaleDateString()
                          : 'None yet'}
                      </strong>
                    </div>
                  </div>

                  {/* Provider Links */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                    {server.accountUrl && (
                      <a
                        href={server.accountUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1"
                      >
                        <span>Official Account Management ({server.accountUrl})</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {server.websiteUrl && (
                      <a
                        href={server.websiteUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-white hover:underline flex items-center gap-1"
                      >
                        <span>Provider Website ({server.websiteUrl})</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {server.healthMessage && (
                      <span className="text-slate-500 italic truncate max-w-md">
                        "{server.healthMessage}"
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab 2: Settings & Routing */}
        {activeTab === 'settings' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-6 pr-1">
            <div className="p-5 rounded-2xl bg-[#121727] border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-rose-400" />
                Automatic Storage Distribution & Selection
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Upload Destination Selection Mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, selectionMode: 'automatic' })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        settings.selectionMode === 'automatic'
                          ? 'bg-rose-500/15 border-rose-500/40 text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-bold text-white">Automatic Distribution</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        System intelligently chooses between Everly, Media.cm, and Local Fast Storage based on health, priorities, and capacity.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, selectionMode: 'manual' })}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        settings.selectionMode === 'manual'
                          ? 'bg-rose-500/15 border-rose-500/40 text-white'
                          : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'
                      }`}
                    >
                      <div className="font-bold text-white">Manual Selection</div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Always uses the configured default storage server or allows the user to explicitly select Everly or Media.cm on upload.
                      </div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Default Upload Destination
                  </label>
                  <select
                    value={settings.defaultServerId}
                    onChange={(e) => setSettings({ ...settings, defaultServerId: e.target.value })}
                    className="w-full bg-[#0c101c] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    {servers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.provider}) {s.enabled ? '' : '[DISABLED]'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Automatic Balancing Strategy
                  </label>
                  <select
                    value={settings.autoDistributionStrategy}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        autoDistributionStrategy: e.target.value as any,
                      })
                    }
                    className="w-full bg-[#0c101c] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-rose-500"
                  >
                    <option value="priority">Priority Order (Highest priority enabled server first)</option>
                    <option value="least_utilized">Least Utilized (Balances storage capacity automatically)</option>
                    <option value="round_robin">Round Robin (Distributes evenly across enabled servers)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-5 py-2 bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Save Routing Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Admin Video Table */}
        {activeTab === 'videos' && (
          <div className="mt-4 flex-1 overflow-y-auto pr-1">
            <div className="p-4 rounded-2xl bg-[#121727] border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Persistent Storage Video Library ({videos.length} videos)
                </h3>
                <span className="text-[11px] text-slate-500">
                  Stored across configured providers (Zero temporary blob URLs)
                </span>
              </div>

              {videos.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  <Film className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <div>No videos currently in persistent storage library.</div>
                  <div className="mt-1 text-slate-600">Upload a video to populate storage servers.</div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="py-2 px-3">File Name</th>
                        <th className="py-2 px-3">Provider</th>
                        <th className="py-2 px-3">Storage Server</th>
                        <th className="py-2 px-3">Size</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Upload Date</th>
                        <th className="py-2 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {videos.map((vid) => {
                        const srv = servers.find((s) => s.id === vid.serverId);
                        return (
                          <tr key={vid.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-2.5 px-3 font-medium text-white max-w-xs truncate">
                              {vid.fileName}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                  vid.provider === 'media_cm'
                                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                                    : vid.provider === 'everly_drive'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                }`}
                              >
                                {vid.provider}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-300">
                              {srv?.name || vid.serverId}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-slate-400">
                              {formatBytes(vid.size)}
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                {vid.status}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-400">
                              {new Date(vid.uploadedAt).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <a
                                  href={`/api/storage/videos/${vid.id}/stream`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="p-1 rounded bg-white/5 hover:bg-white/10 text-cyan-400 hover:text-cyan-300"
                                  title="Play Direct Stream"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </a>
                                {vid.embedUrl && (
                                  <a
                                    href={vid.embedUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300"
                                    title="Open Media.cm Official Embed"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <button
                                  onClick={() => handleDeleteVideo(vid.id, vid.fileName)}
                                  className="p-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300"
                                  title="Safe Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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
          </div>
        )}

        {/* Tab 4: Audit Logs */}
        {activeTab === 'logs' && (
          <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
            {auditLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No storage audit logs recorded yet.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-xl bg-[#121727] border border-white/5 text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-white/5 text-slate-300 font-mono text-[10px]">
                      {log.action}
                    </span>
                    <span className="text-slate-300 truncate max-w-sm">
                      {JSON.stringify(log.details)}
                    </span>
                  </div>
                  <span className="text-slate-500 font-mono text-[11px]">{log.actorEmail}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            Streamora Object Engine · Real Backend Storage & Multi-Provider Sync
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Add / Edit Server Sub-Modal */}
      {(isAddingServer || isEditingServer) && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => {
            setIsAddingServer(false);
            setIsEditingServer(null);
          }}
        >
          <div
            className="relative w-full max-w-lg bg-[#0f1422] border border-rose-500/30 rounded-2xl p-6 shadow-2xl text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white">
                {isEditingServer ? `Edit '${isEditingServer.name}'` : 'Add New Storage Server'}
              </h3>
              <button
                onClick={() => {
                  setIsAddingServer(false);
                  setIsEditingServer(null);
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveServer} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Provider Type</label>
                <select
                  disabled={Boolean(isEditingServer)}
                  value={serverFormData.provider}
                  onChange={(e) => {
                    const provider = e.target.value as any;
                    let defaults: Partial<StorageServer> = { provider };
                    if (provider === 'media_cm') {
                      defaults = {
                        provider,
                        name: 'Media.cm Video Cloud',
                        endpoint: 'https://media.cm',
                        accountUrl: 'https://media.cm/?op=my_files',
                        websiteUrl: 'https://media.cm/',
                        capacityBytes: 10 * 1024 * 1024 * 1024 * 1024,
                        uploadLimitBytes: 300 * 1024 * 1024,
                        priority: 80,
                      };
                    } else if (provider === 'everly_drive') {
                      defaults = {
                        provider,
                        name: 'Everly Cloud Storage',
                        capacityBytes: 30 * 1024 * 1024 * 1024,
                        uploadLimitBytes: 2 * 1024 * 1024 * 1024,
                        priority: 90,
                      };
                    } else if (provider === 'local_disk') {
                      defaults = {
                        provider,
                        name: 'Streamora Fast Storage',
                        capacityBytes: 50 * 1024 * 1024 * 1024,
                        uploadLimitBytes: 4 * 1024 * 1024 * 1024,
                        priority: 100,
                      };
                    }
                    setServerFormData({ ...serverFormData, ...defaults });
                  }}
                  className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                >
                  <option value="media_cm">Media.cm (Official Video Hosting & Embeds)</option>
                  <option value="everly_drive">Everly Cloud Storage (Dual Google Drive)</option>
                  <option value="local_disk">Streamora Primary Fast Storage (Local Volume)</option>
                  <option value="s3_compatible">Amazon S3 / S3-Compatible</option>
                  <option value="cloudflare_r2">Cloudflare R2</option>
                  <option value="google_cloud_storage">Google Cloud Storage (GCS)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Server Name</label>
                <input
                  type="text"
                  required
                  value={serverFormData.name || ''}
                  onChange={(e) => setServerFormData({ ...serverFormData, name: e.target.value })}
                  className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-rose-500"
                  placeholder="e.g. Media.cm Video Cloud"
                />
              </div>

              {/* Provider Specific Configuration Fields */}
              {serverFormData.provider === 'media_cm' && (
                <div className="space-y-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-purple-300 font-medium">Media.cm API Key</label>
                      <a
                        href="https://media.cm/?op=my_files"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-purple-400 hover:underline flex items-center gap-1"
                      >
                        <span>Find at media.cm/?op=my_files</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <input
                      type="password"
                      value={serverFormData.apiKey || ''}
                      onChange={(e) => setServerFormData({ ...serverFormData, apiKey: e.target.value })}
                      className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-mono"
                      placeholder="Paste your Media.cm API key (or set MEDIA_CM_API_KEY in env)"
                    />
                    <div className="text-[10px] text-slate-500 mt-1">
                      Credentials stay strictly server-side and are never exposed to ordinary users.
                    </div>
                  </div>

                  <div>
                    <label className="block text-purple-300 font-medium mb-1">Base Endpoint</label>
                    <input
                      type="text"
                      value={serverFormData.endpoint || 'https://media.cm'}
                      onChange={(e) => setServerFormData({ ...serverFormData, endpoint: e.target.value })}
                      className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-mono text-[11px]"
                    />
                  </div>
                </div>
              )}

              {(serverFormData.provider === 's3_compatible' ||
                serverFormData.provider === 'cloudflare_r2' ||
                serverFormData.provider === 'google_cloud_storage') && (
                <div className="space-y-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20">
                  <div>
                    <label className="block text-cyan-300 font-medium mb-1">Bucket Name</label>
                    <input
                      type="text"
                      value={serverFormData.bucket || ''}
                      onChange={(e) => setServerFormData({ ...serverFormData, bucket: e.target.value })}
                      className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-cyan-300 font-medium mb-1">Access Key ID</label>
                    <input
                      type="text"
                      value={serverFormData.accessKeyId || ''}
                      onChange={(e) => setServerFormData({ ...serverFormData, accessKeyId: e.target.value })}
                      className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-cyan-300 font-medium mb-1">Secret Access Key</label>
                    <input
                      type="password"
                      value={serverFormData.secretAccessKey || ''}
                      onChange={(e) => setServerFormData({ ...serverFormData, secretAccessKey: e.target.value })}
                      className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Priority (1-100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={serverFormData.priority || 50}
                    onChange={(e) => setServerFormData({ ...serverFormData, priority: parseInt(e.target.value, 10) })}
                    className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-medium">Upload Limit (MB)</label>
                  <input
                    type="number"
                    value={Math.round((serverFormData.uploadLimitBytes || 300 * 1024 * 1024) / (1024 * 1024))}
                    onChange={(e) =>
                      setServerFormData({
                        ...serverFormData,
                        uploadLimitBytes: parseInt(e.target.value, 10) * 1024 * 1024,
                      })
                    }
                    className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="srv-enabled"
                  checked={serverFormData.enabled ?? true}
                  onChange={(e) => setServerFormData({ ...serverFormData, enabled: e.target.checked })}
                  className="rounded accent-rose-500"
                />
                <label htmlFor="srv-enabled" className="text-slate-300 cursor-pointer">
                  Enable server for video storage
                </label>
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingServer(false);
                    setIsEditingServer(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-md"
                >
                  {isEditingServer ? 'Update Server' : 'Register Server'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Migration Sub-Modal */}
      {migrationSourceServer && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setMigrationSourceServer(null)}
        >
          <div
            className="relative w-full max-w-md bg-[#0f1422] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-cyan-400" />
                Migrate Videos Safely
              </h3>
              <button onClick={() => setMigrationSourceServer(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <p className="text-slate-300">
                Transfer all active video files from <strong>{migrationSourceServer.name}</strong> ({migrationSourceServer.storedVideoCount} videos) to another active destination before disabling or removing it.
              </p>

              <div>
                <label className="block text-slate-300 mb-1 font-medium">Select Target Destination</label>
                <select
                  value={migrationTargetServerId}
                  onChange={(e) => setMigrationTargetServerId(e.target.value)}
                  className="w-full bg-[#080c16] border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 text-xs"
                >
                  <option value="">-- Choose destination server --</option>
                  {servers
                    .filter((s) => s.id !== migrationSourceServer.id && s.enabled)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.provider}) - Free: {formatBytes(Math.max(0, s.capacityBytes - s.usedBytes))}
                      </option>
                    ))}
                </select>
              </div>

              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 text-[11px]">
                Safe Migration verifies object integrity on the target destination before releasing space on the source server.
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMigrationSourceServer(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!migrationTargetServerId || isMigrating}
                  onClick={handleStartMigration}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-md disabled:opacity-50 flex items-center gap-1.5"
                >
                  <ArrowRightLeft className={`w-3.5 h-3.5 ${isMigrating ? 'animate-spin' : ''}`} />
                  <span>{isMigrating ? 'Migrating...' : 'Execute Safe Migration'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
