const express = require('express');
const router = express.Router();
const Docker = require('dockerode');
const { pool } = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

// Initialize Docker (Connects to local unix socket, or configurable via env)
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

// Get all MT5 Node containers
router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const containers = await docker.listContainers({ all: true });
    
    // Filter for containers with names containing "mt5"
    const mt5Nodes = containers.filter(c => 
      c.Names.some(name => name.toLowerCase().includes('mt5-node'))
    ).map(c => ({
      id: c.Id,
      name: c.Names[0].replace('/', ''),
      state: c.State,
      status: c.Status,
      ports: c.Ports,
      created: c.Created
    }));

    res.json(mt5Nodes);
  } catch (err) {
    console.error('Docker Error:', err.message);
    res.status(500).json({ error: 'Failed to connect to Docker API. Is Docker running and socket accessible?' });
  }
});

// Start a container
router.post('/:id/start', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({ success: true, message: 'Container started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stop a container
router.post('/:id/stop', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop();
    res.json({ success: true, message: 'Container stopped' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
