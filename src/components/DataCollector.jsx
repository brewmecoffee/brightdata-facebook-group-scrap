import React, { useState } from 'react';
import { Calendar, Clock, Download, RefreshCw, List, AlertCircle, Database, DollarSign } from 'lucide-react';
import SnapshotsList from './SnapshotsList';

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
  const [canceling, setCanceling] = useState('');
  const [error, setError] = useState('');

  // Updated state for common date range, time, and group IDs
  const [groupIds, setGroupIds] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('00:00:00');
  const [endTime, setEndTime] = useState('23:59:59');

  const triggerCollection = async () => {
    try {
      setLoading(true);
      setError('');

      // Split and trim group IDs
      const ids = groupIds.split(',').map(id => id.trim()).filter(id => id);

      if (!ids.length) {
        throw new Error('Please enter at least one group ID');
      }

      if (ids.length > 100) {
        throw new Error('Maximum 100 groups allowed');
      }

      // Create request body with group URLs, dates and times (if provided)
      const requestBody = ids.map(id => {
        const groupData = {
          url: `https://facebook.com/groups/${id}`
        };
        
        // Only add dates and times if they are provided
        if (startDate) {
          groupData.start_date = startDate;
          groupData.start_time = startTime;
        }
        
        if (endDate) {
          groupData.end_date = endDate;
          groupData.end_time = endTime;
        }
        
        return groupData;
      });

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

  const cancelSnapshot = async (id) => {
    try {
      setCanceling(id);
      setError('');

      const response = await fetch(`${API_URL}/api/snapshot/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apiToken': apiToken
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel collection');
      }

      // Refresh snapshots list after cancellation
      await getSnapshots();
    } catch (err) {
      console.error('Cancel error:', err);
      setError(err.message || 'Failed to cancel collection');
    } finally {
      setCanceling('');
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

      // Sort snapshots by created date in descending order
      const sortSnapshots = (snapshots) => {
        if (!Array.isArray(snapshots)) return [];
        
        return [...snapshots].sort((a, b) => {
          const createdA = a.created ? new Date(a.created).getTime() : 0;
          const createdB = b.created ? new Date(b.created).getTime() : 0;
          return createdB - createdA; // Descending order (newest first)
        });
      };

      setSnapshots({
        ready: sortSnapshots(ready || []),
        running: sortSnapshots(running || []),
        failed: sortSnapshots(failed || [])
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'ready': return 'text-green-500';
      case 'running': return 'text-blue-500';
      case 'failed': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="space-y-6">
        {/* API Token Input */}
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

        {/* Webhook URL Input */}
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

        {/* Group IDs and Date/Time Inputs */}
        <div className="space-y-4">
          {/* Group IDs Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Facebook Group IDs (comma-separated)</label>
            <textarea
              value={groupIds}
              onChange={(e) => setGroupIds(e.target.value)}
              className="w-full p-2 border rounded-md shadow-sm h-24"
              placeholder="205501299244052, 1675887706091051, 578757699317247..."
            />
            <p className="text-sm text-gray-500">Enter up to 100 group IDs, separated by commas</p>
          </div>

          {/* Date and Time Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start Date and Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Start Date (Optional)</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-8 p-2 border rounded-md shadow-sm"
                  />
                </div>
                <div className="relative">
                  <Clock className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <div className="flex">
                    <select
                      value={startTime.split(':')[0]}
                      onChange={(e) => {
                        const [, m, s] = startTime.split(':');
                        setStartTime(`${e.target.value.padStart(2, '0')}:${m}:${s}`);
                      }}
                      className="pl-8 p-2 border rounded-l-md shadow-sm w-24"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className="inline-flex items-center px-1 text-gray-500">:</span>
                    <select
                      value={startTime.split(':')[1]}
                      onChange={(e) => {
                        const [h, , s] = startTime.split(':');
                        setStartTime(`${h}:${e.target.value}:${s}`);
                      }}
                      className="p-2 border-t border-b border-r shadow-sm w-20"
                    >
                      {Array.from({ length: 60 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className="inline-flex items-center px-1 text-gray-500">:</span>
                    <select
                      value={startTime.split(':')[2]}
                      onChange={(e) => {
                        const [h, m, ] = startTime.split(':');
                        setStartTime(`${h}:${m}:${e.target.value}`);
                      }}
                      className="p-2 border rounded-r-md shadow-sm w-20"
                    >
                      {Array.from({ length: 60 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-500">Time is in IST (GMT+5:30)</p>
            </div>

            {/* End Date and Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700">End Date (Optional)</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <div className="relative">
                  <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-8 p-2 border rounded-md shadow-sm"
                  />
                </div>
                <div className="relative">
                  <Clock className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                  <div className="flex">
                    <select
                      value={endTime.split(':')[0]}
                      onChange={(e) => {
                        const [, m, s] = endTime.split(':');
                        setEndTime(`${e.target.value.padStart(2, '0')}:${m}:${s}`);
                      }}
                      className="pl-8 p-2 border rounded-l-md shadow-sm w-24"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className="inline-flex items-center px-1 text-gray-500">:</span>
                    <select
                      value={endTime.split(':')[1]}
                      onChange={(e) => {
                        const [h, , s] = endTime.split(':');
                        setEndTime(`${h}:${e.target.value}:${s}`);
                      }}
                      className="p-2 border-t border-b border-r shadow-sm w-20"
                    >
                      {Array.from({ length: 60 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    <span className="inline-flex items-center px-1 text-gray-500">:</span>
                    <select
                      value={endTime.split(':')[2]}
                      onChange={(e) => {
                        const [h, m, ] = endTime.split(':');
                        setEndTime(`${h}:${m}:${e.target.value}`);
                      }}
                      className="p-2 border rounded-r-md shadow-sm w-20"
                    >
                      {Array.from({ length: 60 }, (_, i) => (
                        <option key={i} value={i.toString().padStart(2, '0')}>
                          {i.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-500">Time is in IST (GMT+5:30)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 mt-6">
        <button
          onClick={triggerCollection}
          disabled={loading || !apiToken || !groupIds.trim()}
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

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-50 p-4 mt-4">
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

      {/* Current Snapshot Status */}
      {status && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h3 className="text-lg font-medium text-gray-900">Current Snapshot Status</h3>
          <p className={`mt-1 ${getStatusColor(status)} font-medium`}>
            Status: {status.charAt(0).toUpperCase() + status.slice(1)}
          </p>
          {status === 'running' && (
            <button
              onClick={() => cancelSnapshot(snapshotId)}
              disabled={!!canceling}
              className="mt-2 flex items-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              {canceling === snapshotId ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <AlertCircle className="h-4 w-4 mr-2" />
              )}
              {canceling === snapshotId ? 'Canceling Collection...' : 'Cancel Collection'}
            </button>
          )}
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

      {/* Available Snapshots */}
      <div className="mt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Available Snapshots</h3>
        <SnapshotsList
          title="Ready Snapshots"
          snapshots={snapshots.ready}
          status="ready"
          downloadSnapshot={downloadSnapshot}
          cancelSnapshot={cancelSnapshot}
          downloading={downloading}
          canceling={canceling}
          getStatusColor={getStatusColor}
        />
        <SnapshotsList
          title="Running Snapshots"
          snapshots={snapshots.running}
          status="running"
          downloadSnapshot={downloadSnapshot}
          cancelSnapshot={cancelSnapshot}
          downloading={downloading}
          canceling={canceling}
          getStatusColor={getStatusColor}
        />
        <SnapshotsList
          title="Failed Snapshots"
          snapshots={snapshots.failed}
          status="failed"
          downloadSnapshot={downloadSnapshot}
          cancelSnapshot={cancelSnapshot}
          downloading={downloading}
          canceling={canceling}
          getStatusColor={getStatusColor}
        />
      </div>
    </div>
  );
};

export default DataCollector;