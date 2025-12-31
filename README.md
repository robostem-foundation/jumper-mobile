# VEX Match Jumper

![Vercel Analytics Enabled](https://img.shields.io/badge/Vercel%20Analytics-enabled-brightgreen)


A web app for watching VEX competition livestreams without digging through long recordings.

VEX Match Jumper lets you load a competition from RobotEvents and jump directly to individual matches inside the official YouTube livestream. It is built for reviewing matches, scouting teams, and quickly finding specific games after an event.

The app supports events with multiple days and divisions and works with competitions that use more than one stream.

## Features

* Load events using a RobotEvents URL or SKU
* Jump directly to completed matches in the livestream
* Support for multi-day and multi-division competitions
* View teams, rankings, skills, and full match schedules
* Handle events with multiple livestreams
* Playback controls for quick fine adjustments
* Recently viewed events for fast reloading
* Shareable links that open an event already configured

## How It Works

Event data such as teams, divisions, and match schedules is loaded from RobotEvents. Livestream information is pulled from YouTube and used to line up match times with the video.

When a match is selected, the player seeks to the estimated start time using:

```
seekTime = (matchStartTime - streamStartTime) / 1000
```

Manual syncing tools are included to help keep things accurate when streams start early, late, or resume after breaks.

The interface is designed to stay fast and simple while keeping everything in one place.

## Stack

* **Frontend**: React, Vite, Tailwind CSS  
  *Frontend was created with the assistance of AI.*
* **Routing**: React Router  
* **URL State Management**: nuqs  
* **Deployment**: Vercel  

### Backend and Data

* Vercel Serverless Functions
* Vercel Edge Config

### APIs

* RobotEvents API v2
* YouTube Data API v3

## Local Development

To run the project locally:

1. **Clone the repository**

   ```bash
   git clone https://github.com/axcdeng/live-viewer.git
   cd live-viewer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173`.

Environment variables can be added to override default public API keys if needed.

## License

This project is licensed under the Apache License 2.0.