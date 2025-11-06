# Pickup Tracker

![alt text](([https://github.com/CloseZad/pickupTracker/blob/main/PickupTracker.jpeg](https://github.com/CloseZad/pickupTracker/blob/main/PickupTracker.jpeg?raw=true)) "Demo")


A mobile-optimized web application for managing pickup game queues across multiple fields/areas.

## Features

- **Area-based queues**: Separate queue systems for different fields (e.g., "CIF Field A", "CIF Field B", etc.)
- **Real-time updates**: Multiple devices can view and update the same queue (polling every 2 seconds)
- **Game modes**: Currently supports "Winner Stays On" mode
- **Mobile-first design**: Optimized for mobile browsers with responsive Tailwind CSS styling

## Stack

- React.js and vite
- Tailwind CSS
- Express.js server with REST api
- API service hosted on Render

## Setup

1. Install backend dependencies:
```bash
cd backend && npm install
```

2. Install frontend dependencies:
```bash
cd frontend && npm install
```

Or install both at once:
```bash
npm run install:all
```

## Running the Application

You need to run both the backend server and frontend dev server:

**Terminal 1 - Backend:**
```bash
npm run dev:backend
```
This starts the Express server on `http://localhost:3001`

**Terminal 2 - Frontend:**
```bash
npm run dev:frontend
```
This starts the Vite dev server (usually on `http://localhost:5173`)

## Usage

1. **Create a Session**: Select an area (e.g., "CIF Field A") and choose "Winner Stays On" mode
2. **Add Teams**: Enter team names and add them to the queue
3. **Start Game**: Click "Start Game" to move the first two teams to "In Play"
4. **Record Results**: 
   - Click which team won (winner stays, loser goes to back of queue)
   - Or click "Both Teams Go to Queue" to send both teams back
5. **View from Multiple Devices**: Any device can access the same queue by selecting the same area

## API Endpoints

- `GET /api/areas` - Get list of available areas
- `GET /api/queue/:area` - Get queue data for an area
- `POST /api/queue/:area` - Create/update queue for an area
- `POST /api/queue/:area/teams` - Add a team to the queue
- `DELETE /api/queue/:area/teams/:teamId` - Remove a team from the queue
- `POST /api/queue/:area/start-game` - Start a game (move 2 teams to in-play)
- `POST /api/queue/:area/game-result` - Record game result

## Data Storage

Queue data is stored in `backend/data.json`. This file is created automatically when the first queue is created.

