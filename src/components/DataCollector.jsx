import React, { useState } from 'react';
import { Calendar, Clock, Download, RefreshCw, List, AlertCircle, ChevronDown } from 'lucide-react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
  const ITEMS_PER_PAGE = 5;

  // New state for common date range and group IDs
  const [groupIds, setGroupIds] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}-${date.getFullYear()}`;
  };

  const triggerCollection = async () => {
    try {
      setLoading(true);
      setError('');

      // Split and trim group IDs
      const ids = groupIds.split(',').map(id => id.trim()).filter(id => id);

      if (!ids.length) {
        throw new Error('Please enter at least one group ID');
      }

      if (ids.length > 50) {
        throw new Error('Maximum 50 groups allowed');
      }

      // Create request body with group URLs and common date range
      const requestBody = ids.map(id => ({
        url: `https://facebook.com/groups/${id}`,
        start_date: formatDate(startDate),
        end_date: formatDate(endDate)
      }));

      const queryParams = new URLSearchParams({
        datasetId,
        include_errors: true
      });

      if (webhookUrl) {
        queryParams.append('notify', webhookUrl);
      }

      const response = await fetch(`${API_URL}/api/trigger?${queryParams}`, {
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
      const response = await fetch(`${API_URL}/api/progress/${snapshotIdToCheck}`, {
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
        const response = await fetch(`${API_URL}/api/snapshots?datasetId=${datasetId}&status=${status}`, {
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
      const response = await fetch(`${API_URL}/api/snapshot/${id}?format=csv`, {
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
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Facebook Group IDs (comma-separated)</label>
              <textarea
                  value={groupIds}
                  onChange={(e) => setGroupIds(e.target.value)}
                  className="w-full p-2 border rounded-md shadow-sm h-24"
                  placeholder="205501299244052, 1675887706091051, 578757699317247..."
              />
              <p className="text-sm text-gray-500">Enter up to 50 group IDs, separated by commas</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date</label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full pl-8 p-2 border rounded-md shadow-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">End Date</label>
                <div className="relative mt-1">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full pl-8 p-2 border rounded-md shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
                onClick={triggerCollection}
                disabled={loading || !apiToken || !groupIds.trim() || !startDate || !endDate}
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
