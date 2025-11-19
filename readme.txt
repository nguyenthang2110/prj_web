# 📊 Grafana Clone - Full-Stack Dashboard Application

A modern, feature-rich dashboard application inspired by Grafana, built with React, Node.js, and Docker.

## ✨ Features

### Dashboard Management
- ✅ Create, edit, and delete dashboards
- ✅ Multiple dashboard support
- ✅ Dashboard settings and metadata
- ✅ Auto-save functionality

### Panel System
- ✅ Drag & drop panel positioning (React Grid Layout)
- ✅ Resizable panels
- ✅ Multiple visualization types:
  - Line graphs (Recharts)
  - Stat displays
  - Tables
  - Gauges
- ✅ Panel editor with live preview
- ✅ Fullscreen mode

### Data & Queries
- ✅ Query editor with syntax highlighting
- ✅ Multiple datasource support (PostgreSQL, Prometheus, InfluxDB)
- ✅ Real-time data updates
- ✅ Query suggestions
- ✅ Mock data for testing

### Time Range
- ✅ Quick time range selector (5m, 15m, 1h, 24h, etc.)
- ✅ Custom time range picker
- ✅ Auto-refresh intervals (5s, 30s, 1m, 5m)

### UI/UX
- ✅ Dark mode interface (Grafana-inspired)
- ✅ Responsive design
- ✅ Sidebar navigation
- ✅ Keyboard shortcuts support
- ✅ Loading states and error handling

## 🏗️ Architecture

```
project3/
├── frontend/                 # React application
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Dashboard/
│   │   │   │   ├── DashboardGrid.js
│   │   │   │   └── DashboardGrid.css
│   │   │   ├── Panel/
│   │   │   │   ├── Panel.js
│   │   │   │   └── Panel.css
│   │   │   ├── Visualization/
│   │   │   │   ├── GraphVisualization.js
│   │   │   │   ├── StatVisualization.js
│   │   │   │   ├── TableVisualization.js
│   │   │   │   └── GaugeVisualization.js
│   │   │   ├── TimeRange/
│   │   │   │   ├── TimeRangePicker.js
│   │   │   │   └── TimeRangePicker.css
│   │   │   └── QueryEditor/
│   │   │       ├── QueryEditor.js
│   │   │       └── QueryEditor.css
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── package.json
│   └── Dockerfile
├── backend/                  # Node.js API
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
└── .env
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- 8GB RAM minimum

### Installation

1. **Clone or create project structure**
```bash
mkdir ~/project3 && cd ~/project3
```

2. **Copy all files from artifacts**
   - Copy docker-compose.yml
   - Copy frontend Dockerfile
   - Copy backend Dockerfile
   - Copy all React components
   - Copy all CSS files
   - Copy backend API code

3. **Build and start**
```bash
# Build containers
docker-compose build

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f
```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000
   - Health Check: http://localhost:4000/health

## 📖 Usage Guide

### Creating a Dashboard

1. Click "➕ New Dashboard" in the sidebar
2. Enter a dashboard name
3. Click "➕ Add Panel" to add visualizations
4. Configure panel settings:
   - Title
   - Visualization type
   - Query
   - Time range
5. Click "💾 Save" to save changes

### Working with Panels

**Add Panel:**
- Click "➕ Add Panel" button
- New panel appears at the bottom

**Edit Panel:**
- Click ✏️ icon on panel
- Modify title, type, or query
- Click "Save" to apply changes

**Resize Panel:**
- Hover over panel corner
- Drag to resize

**Move Panel:**
- Click and drag panel header
- Drop in desired location

**Delete Panel:**
- Click 🗑️ icon on panel
- Confirm deletion

### Time Range Selection

**Quick Ranges:**
- Click 🕐 button in navbar
- Select from preset ranges (5m, 1h, 24h, etc.)

**Custom Range:**
- Click 🕐 button
- Select "Custom Range"
- Enter start and end dates
- Click "Apply"

**Auto-Refresh:**
- Select refresh interval from dropdown
- Dashboard updates automatically

### Query Editor

1. Click ✏️ on a panel
2. Select datasource (PostgreSQL, Prometheus, InfluxDB)
3. Enter query in the text area
4. Click "▶ Run Query" to test
5. Save panel to apply

## 🔧 API Endpoints

### Dashboards
- `GET /api/dashboards` - List all dashboards
- `GET /api/dashboards/:id` - Get dashboard by ID
- `POST /api/dashboards` - Create dashboard
- `PUT /api/dashboards/:id` - Update dashboard
- `DELETE /api/dashboards/:id` - Delete dashboard

### Panels
- `GET /api/dashboards/:id/panels` - Get panels for dashboard
- `POST /api/dashboards/:id/panels` - Create panel
- `PUT /api/panels/:id` - Update panel
- `DELETE /api/panels/:id` - Delete panel

### Data
- `GET /api/metrics` - Get time-series metrics
- `POST /api/query` - Execute query
- `GET /api/datasources` - List datasources

### System
- `GET /health` - Health check

## 🛠️ Development

### Local Development (without Docker)

**Frontend:**
```bash
cd frontend
npm install
npm start
# Runs on http://localhost:3000
```

**Backend:**
```bash
cd backend
npm install
npm start
# Runs on http://localhost:4000
```

### Adding New Visualization Types

1. Create new component in `src/components/Visualization/`
2. Import in `Panel.js`
3. Add to switch statement in `renderVisualization()`
4. Add option to visualization type selector

### Connecting Real Datasources

1. Update `backend/src/index.js`
2. Add datasource connection logic
3. Implement query execution
4. Format results for frontend

## 🐳 Docker Commands

```bash
# Build containers
docker-compose build

# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f backend

# Restart service
docker-compose restart backend

# Execute command in container
docker-compose exec backend sh

# Remove all containers and volumes
docker-compose down -v
```

## 📊 Database Schema

### Dashboards Table
```sql
CREATE TABLE dashboards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Panels Table
```sql
CREATE TABLE panels (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER REFERENCES dashboards(id),
    title VARCHAR(255),
    type VARCHAR(50),
    query TEXT,
    position_x INTEGER,
    position_y INTEGER,
    position_w INTEGER,
    position_h INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## 🎨 Customization

### Changing Theme Colors

Edit `frontend/src/App.css`:
```css
:root {
    --primary-color: #3b82f6;
    --background: #0b0c0e;
    --surface: #1f1f23;
    --border: #2c2c2f;
}
```

### Adding New Panel Types

1. Create visualization component
2. Add to Panel.js switch statement
3. Update type selector options

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or change port in docker-compose.yml
ports:
  - "3001:3000"
```

### Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Rebuild without cache
docker-compose build --no-cache

# Remove all and restart
docker-compose down -v
docker-compose up -d
```

### Cannot Connect to Backend
- Check backend is running: `docker-compose ps`
- Check backend logs: `docker-compose logs backend`
- Test health endpoint: `curl http://localhost:4000/health`

## 📝 TODO / Roadmap

- [ ] User authentication & authorization
- [ ] Dashboard sharing & permissions
- [ ] Alerting system
- [ ] Plugin system
- [ ] Export dashboards (JSON/PDF)
- [ ] Dashboard templates
- [ ] Variables & filters
- [ ] Annotations
- [ ] Real-time collaboration
- [ ] Mobile app

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

MIT License - feel free to use this project for learning or production!

## 🙏 Acknowledgments

- Inspired by [Grafana](https://grafana.com/)
- Built with [React](https://reactjs.org/)
- Charts powered by [Recharts](https://recharts.org/)
- Grid system by [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout)

---

**Made with ❤️ for monitoring enthusiasts**