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

// Proxy endpoint for triggering data collection
app.post('/api/trigger', async (req, res) => {
  try {
    const apiToken = formatApiToken(req.headers.apitoken);
    if (!apiToken) {
      return res.status(401).json({ error: 'API token is required' });
    }

    const { datasetId, notify } = req.query;
    
    // Validate number of groups
    if (!Array.isArray(req.body) || req.body.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 groups allowed' });
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
      groups: req.body.length,
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
      message: error.message
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

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('API endpoints:');
  console.log(`  POST /api/trigger                    - Trigger data collection`);
  console.log(`  GET  /api/progress/:snapshotId       - Check collection status`);
  console.log(`  GET  /api/snapshots                  - Get snapshots list`);
  console.log(`  GET  /api/snapshot/:snapshotId       - Download snapshot`);
  console.log(`  POST /webhook                        - Webhook endpoint`);
});