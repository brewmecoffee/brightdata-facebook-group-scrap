# Facebook Group Data Collector

A web application that facilitates data collection from Facebook groups using the Brightdata API. This tool allows users to collect data from multiple Facebook groups simultaneously, with support for date-time ranges and webhook notifications.

## Features

- Collect data from up to 100 Facebook groups simultaneously
- Date and time range selection for each group (in IST timezone)
- Support for ISO 8601 timestamp format (YYYY-MM-DDTHH:mm:ss+05:30)
- Real-time status monitoring
- Webhook notifications for collection status updates
- Download collected data in CSV format
- View and manage snapshots with different statuses (Ready, Running, Failed)
- Pagination support for snapshot lists

## Tech Stack

- Frontend:
  - React.js
  - Tailwind CSS
  - Lucide Icons
- Backend:
  - Node.js
  - Express.js
- Deployment:
  - Nginx (Reverse Proxy)
  - Systemd (Process Management)

## Prerequisites

- Node.js (v18 or higher)
- Yarn package manager
- Brightdata API token
- Nginx (for production deployment)

## Development Setup

1. Clone the repository:
```bash
git clone [repository-url]
cd facebook-scraper
```

1. Install dependencies:
```bash
# Install frontend dependencies
yarn install

# Install backend dependencies
cd server
yarn install
cd ..
```

1. Start the development servers:
```bash
# Start backend server (from server directory)
cd server
node server.js

# Start frontend development server (in another terminal)
yarn start
```

The application will be available at `http://localhost:3000`

## Production Deployment

1. Build the React application:
```bash
yarn build
```

1. Set up Nginx configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /var/www/facebook-scraper/build;
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /webhook {
        proxy_pass http://localhost:5000/webhook;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

1. Create systemd service:
```ini
[Unit]
Description=Facebook Scraper Node.js Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/www/facebook-scraper/server
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
```

1. Deploy the application:
```bash
# Create directories
sudo mkdir -p /var/www/facebook-scraper

# Copy files
sudo cp -r build/* /var/www/facebook-scraper/build/
sudo cp -r server/* /var/www/facebook-scraper/server/

# Install production dependencies
cd /var/www/facebook-scraper/server
yarn install --production

# Start the service
sudo systemctl enable facebook-scraper
sudo systemctl start facebook-scraper
```

## API Endpoints

- `POST /api/trigger` - Start data collection
  - Request body format: `[{ url: string, start_date: string, end_date: string, start_time: string, end_time: string }]`
  - Dates should be in YYYY-MM-DD format
  - Times should be in HH:mm:ss format (IST timezone)
- `GET /api/progress/:snapshotId` - Check collection status
- `GET /api/snapshots` - Get snapshots list
- `GET /api/snapshot/:snapshotId` - Download snapshot
- `POST /webhook` - Webhook endpoint for notifications

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Node environment (development/production)

## Usage

1. Enter your Brightdata API token
2. Add Facebook group URLs (up to 100)
3. Set date ranges for data collection
   - Select start and end dates
   - Choose start and end times (in IST timezone)
   - Times will be converted to ISO 8601 format with IST offset (+05:30)
4. Optionally add a webhook URL for notifications
5. Start collection and monitor progress
6. Download data when collection is complete

### Time Format Examples
- Start: `2024-12-20` at `00:00:00` becomes `2024-12-20T00:00:00+05:30`
- End: `2024-12-21` at `23:59:59` becomes `2024-12-21T23:59:59+05:30`

## Monitoring

```bash
# View Node.js server logs
sudo journalctl -u facebook-scraper -f

# View Nginx access logs
sudo tail -f /var/log/nginx/access.log

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support, please open an issue in the GitHub repository.