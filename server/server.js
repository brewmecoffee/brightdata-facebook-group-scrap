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

// Helper function to validate a date string
const isValidDateFormat = (dateStr) => {
  // Expected format: MM-DD-YYYY
  const regex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-\d{4}$/;
  if (!regex.test(dateStr)) return false;
  
  const [month, day, year] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day && date.getFullYear() === year;
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
    
    if (req.body.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 groups allowed' });
    }

    // Validate each group's data
    for (const group of req.body) {
      if (!group.url || !group.start_date || !group.end_date) {
        return res.status(400).json({ 
          error: 'Each group must have url, start_date, and end_date' 
        });
      }

      if (!isValidGroupUrl(group.url)) {
        return res.status(400).json({ 
          error: 'Invalid Facebook group URL: ' + group.url 
        });
      }

      if (!isValidDateFormat(group.start_date)) {
        return res.status(400).json({ 
          error: 'Invalid start date format. Use MM-DD-YYYY: ' + group.start_date 
        });
      }

      if (!isValidDateFormat(group.end_date)) {
        return res.status(400).json({ 
          error: 'Invalid end date format. Use MM-DD-YYYY: ' + group.end_date 
        });
      }

      // Validate date range
      const startDate = new Date(group.start_date);
      const endDate = new Date(group.end_date);
      if (endDate < startDate) {
        return res.status(400).json({ 
          error: 'End date cannot be earlier than start date' 
        });
      }
    }

    const queryParams = new URLSearchParams({
      dataset_id: datasetId,
      include_errors: true
    });

    if (notify) {
      queryParams.append('notify', notify);
    }

    console.log('Making request to Brightdata with:', {
      url: `https://api.brightdata.com/datasets/v3/trigger`,
      groups: req.body.map(g => ({
        url: g.url,
        date_range: `${g.start_date} to ${g.end_date}`
      })),
      notify: !!notify
    });

    const response = await axios.post(
      `https://api.brightdata.com/datasets/v3/trigger?${queryParams}`,
      req.body,
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
  console.log(`  POST /webhook                        - Webhook endpoint`);
});
