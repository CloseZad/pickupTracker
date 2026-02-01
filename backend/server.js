import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, "data.json");

// Middleware
app.use(cors());
app.use(express.json());

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({}));
}

// Helper functions
function readData() {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    return {};
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Get queue for an area
app.get("/api/queue/:area", (req, res) => {
  const { area } = req.params;
  const data = readData();

  if (!data[area]) {
    data[area] = {
      mode: null,
      teams: [],
      inPlay: [],
      score: { team1: 0, team2: 0 },
    };
    writeData(data);
  }

  res.json(data[area]);
});

// Create or update queue for an area
app.post("/api/queue/:area", (req, res) => {
  const { area } = req.params;
  const { mode } = req.body;

  const data = readData();

  if (!data[area]) {
    data[area] = {
      mode,
      teams: [],
      inPlay: [],
      score: { team1: 0, team2: 0 },
    };
  } else {
    data[area].mode = mode;
    if (!data[area].score) {
      data[area].score = { team1: 0, team2: 0 };
    }
  }

  writeData(data);
  res.json(data[area]);
});

// Add team to queue
app.post("/api/queue/:area/teams", (req, res) => {
  const { area } = req.params;
  const { name } = req.body;

  if (!name || name.trim() === "") {
    return res.status(400).json({ error: "Team name is required" });
  }

  const data = readData();

  if (!data[area]) {
    return res
      .status(404)
      .json({ error: "Area not found. Please create a session first." });
  }

  if (data[area].teams.some((team) => team.name === name.trim())) {
    return res.status(400).json({ error: "Team name already exists" });
  }

  data[area].teams.push({ name: name.trim(), id: Date.now().toString() });
  writeData(data);

  res.json(data[area]);
});

// Reorder the queue (EDIT)
app.post("/api/queue/:area/reorder", (req, res) => {
  const { area } = req.params;
  const { teams } = req.body;

  // 1. Load current data
  const data = readData();

  // 2. Validate session exists
  if (!data[area]) {
    return res.status(404).json({ error: "Session not found" });
  }

  // 3. Validate input
  if (!Array.isArray(teams)) {
    return res.status(400).json({ error: "Invalid data format" });
  }

  // 4. Save the new order
  data[area].teams = teams;
  writeData(data);

  // 5. Respond
  res.json({ success: true, teams: data[area].teams });
});

// Remove team from queue
app.delete("/api/queue/:area/teams/:teamId", (req, res) => {
  const { area } = req.params;
  const { teamId } = req.params;

  const data = readData();

  if (!data[area]) {
    return res.status(404).json({ error: "Area not found" });
  }

  data[area].teams = data[area].teams.filter((team) => team.id !== teamId);
  data[area].inPlay = data[area].inPlay.filter((team) => team.id !== teamId);

  writeData(data);
  res.json(data[area]);
});

// Start game (move teams from queue to in-play)
app.post("/api/queue/:area/start-game", (req, res) => {
  const { area } = req.params;

  const data = readData();

  if (!data[area]) {
    return res.status(404).json({ error: "Area not found" });
  }

  if (data[area].inPlay.length >= 2) {
    return res.status(400).json({ error: "Game already in progress" });
  }

  if (data[area].teams.length < 2) {
    return res
      .status(400)
      .json({ error: "Need at least 2 teams to start a game" });
  }

  // Move first two teams to in-play
  const teamsToMove = data[area].teams.splice(0, 2);
  data[area].inPlay = [...data[area].inPlay, ...teamsToMove];

  // Reset score when starting a new game
  if (data[area].score) {
    data[area].score = { team1: 0, team2: 0 };
  }

  writeData(data);
  res.json(data[area]);
});

// Record game result
app.post("/api/queue/:area/game-result", (req, res) => {
  const { area } = req.params;
  const { winner, loser, bothLose } = req.body;

  const data = readData();

  if (!data[area]) {
    return res.status(404).json({ error: "Area not found" });
  }

  if (!data[area].mode) {
    return res.status(400).json({ error: "No game mode set" });
  }

  if (data[area].mode === "winner-stays-on") {
    if (bothLose) {
      // Both teams go to back of queue
      data[area].teams.push(...data[area].inPlay);
      data[area].inPlay = [];
    } else if (winner && loser) {
      // Winner stays, loser goes to back of queue
      const winnerTeam = data[area].inPlay.find((t) => t.id === winner);
      const loserTeam = data[area].inPlay.find((t) => t.id === loser);

      if (!winnerTeam || !loserTeam) {
        return res.status(400).json({ error: "Invalid team IDs" });
      }

      data[area].teams.push(loserTeam);
      data[area].inPlay = [winnerTeam];
    } else {
      return res.status(400).json({ error: "Invalid game result" });
    }

    // Move next team(s) to in-play if available
    while (data[area].inPlay.length < 2 && data[area].teams.length > 0) {
      data[area].inPlay.push(data[area].teams.shift());
    }
  } else if (data[area].mode === "classic") {
    if (bothLose) {
      // Both teams go to back of queue
      data[area].teams.push(...data[area].inPlay);
      data[area].inPlay = [];
      // Reset score
      if (data[area].score) {
        data[area].score = { team1: 0, team2: 0 };
      }
    } else {
      return res
        .status(400)
        .json({ error: "Invalid game result for classic mode" });
    }
  }

  writeData(data);
  res.json(data[area]);
});

// Update score
app.post("/api/queue/:area/score", (req, res) => {
  const { area } = req.params;
  const { team1, team2 } = req.body;

  const data = readData();

  if (!data[area]) {
    return res.status(404).json({ error: "Area not found" });
  }

  if (!data[area].score) {
    data[area].score = { team1: 0, team2: 0 };
  }

  if (team1 !== undefined) {
    data[area].score.team1 = Math.max(0, parseInt(team1) || 0);
  }
  if (team2 !== undefined) {
    data[area].score.team2 = Math.max(0, parseInt(team2) || 0);
  }

  writeData(data);
  res.json(data[area]);
});

// Change the areas GET route to return keys from your JSON file
app.get("/api/areas", (req, res) => {
  const data = readData();
  // Get all existing session names from the data object
  const existingAreas = Object.keys(data);
  res.json(existingAreas);
});

// // Update or Add a New Session
// app.post("/api/queue/:area", (req, res) => {
//   const { area } = req.params; // This will now be the custom name from user input
//   const { mode } = req.body;

//   const data = readData();

//   // If the area doesn't exist, we create it dynamically
//   if (!data[area]) {
//     data[area] = {
//       mode,
//       teams: [],
//       inPlay: [],
//       score: { team1: 0, team2: 0 },
//     };
//   } else {
//     data[area].mode = mode;
//   }

//   writeData(data);
//   res.json(data[area]);
// });

// === Scheduled Reset: clear data.json every midnight ===
cron.schedule("0 0 * * *", () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify({}));
    console.log(
      "✅ Data reset successfully at midnight:",
      new Date().toLocaleString()
    );
  } catch (err) {
    console.error("❌ Failed to reset data.json:", err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
