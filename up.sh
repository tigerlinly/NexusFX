#!/bin/bash
echo "🔄 Pulling latest NexusFX changes..."
git pull origin main

echo "🚀 Deploying NexusFX Web App (Backend API + Frontend) with Docker..."
docker-compose up -d --build web api

echo "📂 Cleaning up old unused images to save disk space..."
docker image prune -f

echo "📋 Checking container statuses..."
docker ps | grep nexusfx

echo "✅ App Deployment Complete!"
