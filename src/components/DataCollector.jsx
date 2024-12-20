import React, { useState } from 'react';
import { Calendar, Clock, Download, RefreshCw, List, AlertCircle, Plus, Trash2, ChevronDown } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000/api';
const MAX_GROUPS = 10;
const ITEMS_PER_PAGE = 5;

const DataCollector = () => {
  const [apiToken, setApiToken] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [datasetId] = useState('gd_lz11l67o2cb3r0lkj3');
  const [snapshotId, setSnapshotId] = useState('');
  const [status, setStatus] = useState('');
  const [snapshots, setSnapshots] = useState({ ready: [], running: [], failed: [] });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState({ ready: false, running: false, failed: false });

  // Multiple groups state
  const [groups, setGroups] = useState([
    { url: '', startDate: '', endDate: '' }
  ]);

  const addGroup = () => {
    if (groups.length < MAX_GROUPS) {
      setGroups([...groups, { url: '', startDate: '', endDate: '' }]);
    }
  };

  const removeGroup = (index) => {
    const newGroups = groups.filter((_, i) => i !== index);
    setGroups(newGroups.length ? newGroups : [{ url: '', startDate: '', endDate: '' }]);
  };

  const updateGroup = (index, field, value) => {
    const newGroups = [...groups];
    newGroups[index] = { ...newGroups[index], [field]: value };
    setGroups(newGroups);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}-${date.getFullYear()}`;
  };

  const triggerCollection = async () => {
    try {
      setLoading(true);
      setError('');

      const requestBody = groups.filter(group => group.url).map(group => ({
        url: group.url,
        start_date: formatDate(group.startDate),
        end_date: formatDate(group.endDate)
      }));

      const queryParams = new URLSearchParams({
        datasetId,
        include_errors: true
      });

      if (webhookUrl) {
        queryParams.append('notify', webhookUrl);
      }

      const response = await fetch(`${API_BASE_URL}/trigger?${queryParams}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apiToken': apiToken
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to trigger collection');
      }

      if (data.snapshot_id) {
        setSnapshotId(data.snapshot_id);
        setStatus('running');
        checkStatus(data.snapshot_id);
      } else {
        throw new Error('No snapshot ID received');
      }
    } catch (err) {
      console.error('Collection error:', err);
      setError(err.message || 'Failed to trigger data collection');
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async (id) => {
    const snapshotIdToCheck = id || snapshotId;
    if (!snapshotIdToCheck) return;

    try {
      const response = await fetch(`${API_BASE_URL}/progress/${snapshotIdToCheck}`, {
        headers: {
          'apiToken': apiToken
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check status');
      }

      setStatus(data.status);

      if (data.status === 'running') {
        setTimeout(() => checkStatus(snapshotIdToCheck), 5000);
      } else if (data.status === 'failed') {
        setError(data.error || 'Collection failed');
      }
    } catch (err) {
      console.error('Status check error:', err);
      setError(err.message || 'Failed to check status');
    }
  };

  const getSnapshots = async () => {
    try {
      setLoading(true);
      setError('');

      const fetchSnapshotsForStatus = async (status) => {
        const response = await fetch(`${API_BASE_URL}/snapshots?datasetId=${datasetId}&status=${status}`, {
          headers: {
            'apiToken': apiToken
          }
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch ${status} snapshots`);
        }

        return response.json();
      };

      const [ready, running, failed] = await Promise.all([
        fetchSnapshotsForStatus('ready'),
        fetchSnapshotsForStatus('running'),
        fetchSnapshotsForStatus('failed')
      ]);

      setSnapshots({
        ready: ready || [],
        running: running || [],
        failed: failed || []
      });
    } catch (err) {
      console.error('Snapshots error:', err);
      setError(err.message || 'Failed to fetch snapshots');
    } finally {
      setLoading(false);
    }
  };

  const downloadSnapshot = async (id) => {
    setDownloading(id);
    try {
      const response = await fetch(`${API_BASE_URL}/snapshot/${id}?format=csv`, {
        headers: {
          'apiToken': apiToken
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snapshot-${id}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download snapshot');
    } finally {
      setDownloading('');
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return 'text-green-500';
      case 'running': return 'text-blue-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const SnapshotsList = ({ title, snapshots, status }) => {
    if (!snapshots.length) return null;

    const displayedSnapshots = expandedSections[status]
        ? snapshots
        : snapshots.slice(0, ITEMS_PER_PAGE);

    return (
        <div className="mt-4">
          <h4 className={`font-medium ${getStatusColor(status)}`}>{title}</h4>
          <div className="space-y-2 mt-2">
            {displayedSnapshots.map((snapshot) => (
                <div key={snapshot.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900">{snapshot.id}</p>
                  {status === 'ready' && (
                      <button
                          onClick={() => downloadSnapshot(snapshot.id)}
                          disabled={!!downloading}
                          className="flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {downloading === snapshot.id ? (
                            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                            <Download className="h-4 w-4 mr-1" />
                        )}
                        {downloading === snapshot.id ? 'Downloading...' : 'Download'}
                      </button>
                  )}
                  {status === 'failed' && (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  {status === 'running' && (
                      <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                  )}
                </div>
            ))}
            {snapshots.length > ITEMS_PER_PAGE && (
                <button
                    onClick={() => toggleSection(status)}
                    className="flex items-center justify-center w-full px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
                >
                  <ChevronDown className={`h-4 w-4 mr-1 transform ${expandedSections[status] ? 'rotate-180' : ''}`} />
                  {expandedSections[status] ? 'Show Less' : `Show ${snapshots.length - ITEMS_PER_PAGE} More`}
                </button>
            )}
          </div>
        </div>
    );
  };

  const GroupInput = ({ group, index }) => (
      <div className="p-4 border rounded-lg bg-gray-50">
        <div className="flex justify-between items-start mb-4">
          <h4 className="text-sm font-medium text-gray-700">Group {index + 1}</h4>
          {groups.length > 1 && (
              <button
                  onClick={() => removeGroup(index)}
                  className="text-red-500 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <input
                type="text"
                value={group.url}
                onChange={(e) => updateGroup(index, 'url', e.target.value)}
                className="w-full p-2 border rounded-md shadow-sm"
                placeholder="https://facebook.com/groups/..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                  type="date"
                  value={group.startDate}
                  onChange={(e) => updateGroup(index, 'startDate', e.target.value)}
                  className="w-full pl-8 p-2 border rounded-md shadow-sm"
              />
            </div>

            <div className="relative">
              <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                  type="date"
                  value={group.endDate}
                  onChange={(e) => updateGroup(index, 'endDate', e.target.value)}
                  className="w-full pl-8 p-2 border rounded-md shadow-sm"
              />
            </div>
          </div>
        </div>
      </div>
  );

  return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">API Token</label>
            <input
                type="password"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                className="w-full p-2 border rounded-md shadow-sm"
                placeholder="Enter your Brightdata API token"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Webhook URL (Optional)</label>
            <input
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="w-full p-2 border rounded-md shadow-sm"
                placeholder="https://your-webhook-url.com/webhook"
            />
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-medium text-gray-700">Facebook Groups</label>
              {groups.length < MAX_GROUPS && (
                  <button
                      onClick={addGroup}
                      className="flex items-center text-sm text-blue-600 hover:text-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Group
                  </button>
              )}
            </div>

            <div className="space-y-4">
              {groups.map((group, index) => (
                  <GroupInput key={index} group={group} index={index} />
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
                onClick={triggerCollection}
                disabled={loading || !apiToken || !groups.some(g => g.url)}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? (
                  <RefreshCw className="animate-spin h-4 w-4 mr-2" />
              ) : (
                  <Clock className="h-4 w-4 mr-2" />
              )}
              Start Collection
            </button>

            <button
                onClick={getSnapshots}
                disabled={loading || !apiToken}
                className="flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
            >
              <List className="h-4 w-4 mr-2" />
              View Snapshots
            </button>
          </div>

          {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {status && (
              <div className="mt-4 p-4 bg-gray-50 rounded-md">
                <h3 className="text-lg font-medium text-gray-900">Current Snapshot Status</h3>
                <p className={`mt-1 ${getStatusColor(status)} font-medium`}>
                  Status: {status.charAt(0).toUpperCase() + status.slice(1)}
                </p>
                {status === 'ready' && (
                    <button
                        onClick={() => downloadSnapshot(snapshotId)}
                        disabled={!!downloading}
                        className="mt-2 flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {downloading === snapshotId ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                          <Download className="h-4 w-4 mr-2" />
                      )}
                      {downloading === snapshotId ? 'Downloading...' : 'Download Data'}
                    </button>
                )}
              </div>
          )}

          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Available Snapshots</h3>
            <SnapshotsList title="Ready Snapshots" snapshots={snapshots.ready} status="ready" />
            <SnapshotsList title="Running Snapshots" snapshots={snapshots.running} status="running" />
            <SnapshotsList title="Failed Snapshots" snapshots={snapshots.failed} status="failed" />
          </div>
        </div>
      </div>
  );
};

export default DataCollector;