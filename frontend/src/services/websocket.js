// frontend/src/services/websocket.js
class WebSocketService {
    constructor() {
      this.ws = null;
      this.listeners = {};
      this.reconnectInterval = 5000;
      this.reconnectAttempts = 0;
      this.maxReconnectAttempts = 10;
    }
  
    connect(token) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        return;
      }
  
      const wsUrl = `ws://localhost:4000?token=${token}`;
      this.ws = new WebSocket(wsUrl);
  
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('connected');
      };
  
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('WebSocket message error:', err);
        }
      };
  
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.emit('disconnected');
        this.attemptReconnect(token);
      };
  
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('error', error);
      };
    }
  
    attemptReconnect(token) {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
        setTimeout(() => this.connect(token), this.reconnectInterval);
      }
    }
  
    handleMessage(data) {
      const { type, payload } = data;
      
      switch (type) {
        case 'alert':
          this.emit('alert', payload);
          break;
        case 'metric_update':
          this.emit('metric', payload);
          break;
        case 'dashboard_update':
          this.emit('dashboard', payload);
          break;
        case 'notification':
          this.emit('notification', payload);
          break;
        default:
          console.log('Unknown message type:', type);
      }
    }
  
    send(type, payload) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type, payload }));
      } else {
        console.error('WebSocket not connected');
      }
    }
  
    on(event, callback) {
      if (!this.listeners[event]) {
        this.listeners[event] = [];
      }
      this.listeners[event].push(callback);
    }
  
    off(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    }
  
    emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach(callback => callback(data));
      }
    }
  
    disconnect() {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
    }
  
    // Subscribe to specific dashboard updates
    subscribeDashboard(dashboardId) {
      this.send('subscribe', { type: 'dashboard', id: dashboardId });
    }
  
    // Subscribe to alert updates
    subscribeAlerts() {
      this.send('subscribe', { type: 'alerts' });
    }
  
    // Subscribe to metric stream
    subscribeMetrics(metricName) {
      this.send('subscribe', { type: 'metric', name: metricName });
    }
  }
  
  export default new WebSocketService();