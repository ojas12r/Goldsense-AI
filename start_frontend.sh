#!/bin/bash
cd "$(dirname "$0")/frontend"
npm install
echo "✅ Frontend at http://localhost:3000"
npm start
