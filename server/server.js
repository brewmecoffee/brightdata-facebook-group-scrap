const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Helper function to format the API token
const formatApiToken = (token) => {
  if (!token) return null;
  return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
};

// Helper function to convert local datetime to ISO string with IST offset
const convertToISOWithIST = (dateStr, timeStr = '00:00:00') => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes, seconds] = timeStr.split(':').map(Number);

  // Create date in local timezone
  const date = new Date(year, month - 1, day, hours, minutes, seconds);

  // Format with IST offset (+05:30)
  return date.toISOString().slice(0, 19) + '+05:30';
};

// Helper function to validate a date string in YYYY-MM-DD format
const isValidDateFormat = (dateStr) => {
  // Expected format: YYYY-MM-DD
  const regex = /^\d{4}-([0][1-9]|[1][0-2])-([0][1-9]|[1-2][0-9]|[3][0-1])$/;
  if (!regex.test(dateStr)) return false;

  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day && date.getFullYear() === year;
};

// Helper function to validate time string in HH:mm:ss format
const isValidTimeFormat = (timeStr) => {
  if (!timeStr) return true; // Time is optional
  const regex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
  return regex.test(timeStr);
};

// Helper function to validate Facebook group URLs and IDs
const isValidGroupUrl = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname === 'facebook.com' &&
        urlObj.pathname.startsWith('/groups/') &&
        urlObj.pathname.split('/')[2]?.length > 0;
  } catch {
    return false;
  }
};

// Proxy endpoint for triggering data collection
app.post('/api/trigger', async (req, res) => {
  try {
    const apiToken = formatApiToken(req.headers.apitoken);
    if (!apiToken) {
      return res.status(401).json({ error: 'API token is required' });
    }

    const { datasetId, notify } = req.query;

    // Validate number of groups
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'At least one group is required' });
    }

    if (req.body.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 groups allowed' });
    }

    // Validate each group's data
    for (const group of req.body) {
      if (!group.url) {
        return res.status(400).json({
          error: 'Each group must have a url'
        });
      }

      if (!isValidGroupUrl(group.url)) {
        return res.status(400).json({
          error: 'Invalid Facebook group URL: ' + group.url
        });
      }

      // Validate start date and time if provided
      if (group.start_date) {
        if (!isValidDateFormat(group.start_date)) {
          return res.status(400).json({
            error: 'Invalid start date format. Use YYYY-MM-DD: ' + group.start_date
          });
        }
        if (group.start_time && !isValidTimeFormat(group.start_time)) {
          return res.status(400).json({
            error: 'Invalid start time format. Use HH:mm:ss: ' + group.start_time
          });
        }
      }

      // Validate end date and time if provided
      if (group.end_date) {
        if (!isValidDateFormat(group.end_date)) {
          return res.status(400).json({
            error: 'Invalid end date format. Use YYYY-MM-DD: ' + group.end_date
          });
        }
        if (group.end_time && !isValidTimeFormat(group.end_time)) {
          return res.status(400).json({
            error: 'Invalid end time format. Use HH:mm:ss: ' + group.end_time
          });
        }
      }

      // Validate date range if both dates are provided
      if (group.start_date && group.end_date) {
        const startDateTime = new Date(group.start_date + 'T' + (group.start_time || '00:00:00'));
        const endDateTime = new Date(group.end_date + 'T' + (group.end_time || '23:59:59'));
        if (endDateTime < startDateTime) {
          return res.status(400).json({
            error: 'End datetime cannot be earlier than start datetime'
          });
        }
      }
    }

    // Transform the request body to include ISO timestamps with IST offset
    const transformedBody = req.body.map(group => {
      const transformed = {
        url: group.url
      };
      
      // Add start_date if provided
      if (group.start_date) {
        transformed.start_date = convertToISOWithIST(group.start_date, group.start_time);
      }
      
      // Add end_date if provided
      if (group.end_date) {
        transformed.end_date = convertToISOWithIST(group.end_date, group.end_time || '23:59:59');
      }
      
      return transformed;
    });

    const queryParams = new URLSearchParams({
      dataset_id: datasetId,
      include_errors: true
    });

    if (notify) {
      queryParams.append('notify', notify);
    }

    console.log('Making request to Brightdata with:', {
      url: `https://api.brightdata.com/datasets/v3/trigger`,
      groups: transformedBody.map(g => ({
        url: g.url,
        start_date: g.start_date,
        end_date: g.end_date
      })),
      notify: !!notify
    });

    const response = await axios.post(
        `https://api.brightdata.com/datasets/v3/trigger?${queryParams}`,
        transformedBody,
        {
          headers: {
            'Authorization': apiToken,
            'Content-Type': 'application/json'
          }
        }
    );

    console.log('Brightdata response:', response.data);
    res.json(response.data);
  } catch (error) {
    console.error('Brightdata error:', {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message,
      stack: error.stack
    });

    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Internal server error'
    });
  }
});

// Proxy endpoint for checking status
app.get('/api/progress/:snapshotId', async (req, res) => {
  try {
    const apiToken = formatApiToken(req.headers.apitoken);
    if (!apiToken) {
      return res.status(401).json({ error: 'API token is required' });
    }

    const { snapshotId } = req.params;

    const response = await axios.get(
        `https://api.brightdata.com/datasets/v3/progress/${snapshotId}`,
        {
          headers: {
            'Authorization': apiToken
          }
        }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Internal server error'
    });
  }
});

// Proxy endpoint for getting snapshots by status
app.get('/api/snapshots', async (req, res) => {
  try {
    const apiToken = formatApiToken(req.headers.apitoken);
    if (!apiToken) {
      return res.status(401).json({ error: 'API token is required' });
    }

    const { datasetId, status } = req.query;

    // Validate status
    if (!['ready', 'running', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status parameter' });
    }

    console.log(`Fetching ${status} snapshots for dataset ${datasetId}`);

    const response = await axios.get(
        `https://api.brightdata.com/datasets/v3/snapshots?dataset_id=${datasetId}&status=${status}`,
        {
          headers: {
            'Authorization': apiToken
          }
        }
    );
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Internal server error'
    });
  }
});

// Proxy endpoint for canceling a snapshot
app.post('/api/snapshot/:snapshotId/cancel', async (req, res) => {
  try {
    const apiToken = formatApiToken(req.headers.apitoken);
    if (!apiToken) {
      return res.status(401).json({ error: 'API token is required' });
    }

    const { snapshotId } = req.params;

    const response = await axios.post(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}/cancel`,
        {},
        {
          headers: {
            'Authorization': apiToken,
            'Content-Type': 'application/json'
          }
        }
    );

    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Internal server error'
    });
  }
});

// Proxy endpoint for downloading snapshots
app.get('/api/snapshot/:snapshotId', async (req, res) => {
  try {
    const apiToken = formatApiToken(req.headers.apitoken);
    if (!apiToken) {
      return res.status(401).json({ error: 'API token is required' });
    }

    const { snapshotId } = req.params;
    const { format = 'csv' } = req.query;

    const response = await axios.get(
        `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}?format=${format}`,
        {
          headers: {
            'Authorization': apiToken
          },
          responseType: 'stream'
        }
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=snapshot-${snapshotId}.csv`);
    response.data.pipe(res);
  } catch (error) {
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.message || error.message || 'Internal server error'
    });
  }
});

// Webhook endpoint to receive notifications
app.post('/webhook', (req, res) => {
  console.log('Received webhook notification:', {
    snapshotId: req.body.snapshot_id,
    status: req.body.status,
    timestamp: new Date().toISOString()
  });
  res.status(200).json({ message: 'Webhook received' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('API endpoints:');
  console.log(`  POST /api/trigger                    - Trigger data collection`);
  console.log(`  GET  /api/progress/:snapshotId       - Check collection status`);
  console.log(`  GET  /api/snapshots                  - Get snapshots list`);
  console.log(`  GET  /api/snapshot/:snapshotId       - Download snapshot`);
  console.log(`  POST /api/snapshot/:snapshotId/cancel - Cancel snapshot`);
  console.log(`  POST /webhook                        - Webhook endpoint`);
});
