import { useState, useEffect } from "react";
import "./index.css";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const API_BASE = "https://pickuptracker.onrender.com/api";
// const API_BASE = "http://localhost:3001/api";

function App() {
  const [selectedArea, setSelectedArea] = useState(null);
  const [areas, setAreas] = useState([]);
  const [mode, setMode] = useState("");
  const [teams, setTeams] = useState([]);
  const [inPlay, setInPlay] = useState([]);
  const [newTeamName, setNewTeamName] = useState("");
  const [sessionCreated, setSessionCreated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backendDown, setBackendDown] = useState(false);
  const [score, setScore] = useState({ team1: 0, team2: 0 });
  const [showScoreView, setShowScoreView] = useState(false);

  const [customAreaName, setCustomAreaName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Fetch available areas
  useEffect(() => {
    fetch(`${API_BASE}/areas`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setAreas(data);
        setBackendDown(false); //Backend is up
      })
      .catch((error) => {
        console.error("Error fetching areas:", error);
        setBackendDown(true); // Backend likely down
      });
  }, []);

  // One-time fetch when area changes (to check if session exists)
  useEffect(() => {
    if (selectedArea) {
      // Reset session state when switching areas
      setSessionCreated(false);
      setMode("");
      setTeams([]);
      setInPlay([]);

      // Check if session exists for this area
      fetch(`${API_BASE}/queue/${encodeURIComponent(selectedArea)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.mode) {
            // Session already exists for this area
            setMode(data.mode);
            setSessionCreated(true);
            setTeams(data.teams || []);
            setInPlay(data.inPlay || []);
            if (data.score) {
              setScore(data.score);
            }
          }
        })
        .catch((error) => console.error("Error fetching queue:", error));
    }
  }, [selectedArea]);

  // Poll queue data only when session is created
  useEffect(() => {
    if (sessionCreated && selectedArea) {
      fetchQueue();
      const interval = setInterval(fetchQueue, 2000); // Poll every 2 seconds
      return () => clearInterval(interval);
    }
  }, [sessionCreated, selectedArea]);

  const fetchQueue = async () => {
    if (!selectedArea || !sessionCreated) return;
    try {
      const res = await fetch(
        `${API_BASE}/queue/${encodeURIComponent(selectedArea)}`
      );
      const data = await res.json();
      // Only update teams and inPlay during polling - don't touch form fields
      setTeams(data.teams || []);
      setInPlay(data.inPlay || []);
      if (data.score) {
        setScore(data.score);
      }
    } catch (error) {
      console.error("Error fetching queue:", error);
    }
  };

  const createSession = async () => {
    // Determine which name to use
    const areaToUse = isCreatingNew ? customAreaName.trim() : selectedArea;

    if (!areaToUse || !mode) return;

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/queue/${encodeURIComponent(areaToUse)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        }
      );
      if (res.ok) {
        if (isCreatingNew) {
          setAreas((prev) => [...prev, areaToUse]);
        }

        setSelectedArea(areaToUse);
        setSessionCreated(true);
      }
    } catch (error) {
      console.error("Error creating session:", error);
    } finally {
      setLoading(false);
    }
  };

  const addTeam = async () => {
    if (!newTeamName.trim() || !selectedArea) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/queue/${encodeURIComponent(selectedArea)}/teams`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newTeamName.trim() }),
        }
      );
      if (res.ok) {
        setNewTeamName("");
        await fetchQueue();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to add team");
      }
    } catch (error) {
      console.error("Error adding team:", error);
      alert("Failed to add team");
    } finally {
      setLoading(false);
    }
  };

  const removeTeam = async (teamId) => {
    if (!selectedArea) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/queue/${encodeURIComponent(selectedArea)}/teams/${teamId}`,
        {
          method: "DELETE",
        }
      );
      if (res.ok) {
        await fetchQueue();
      }
    } catch (error) {
      console.error("Error removing team:", error);
    } finally {
      setLoading(false);
    }
  };

  const startGame = async () => {
    if (!selectedArea) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/queue/${encodeURIComponent(selectedArea)}/start-game`,
        {
          method: "POST",
        }
      );
      if (res.ok) {
        await fetchQueue();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to start game");
      }
    } catch (error) {
      console.error("Error starting game:", error);
      alert("Failed to start game");
    } finally {
      setLoading(false);
    }
  };

  const updateScore = async (team1, team2) => {
    if (!selectedArea) return;
    try {
      const res = await fetch(
        `${API_BASE}/queue/${encodeURIComponent(selectedArea)}/score`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ team1, team2 }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        setScore(data.score || { team1: 0, team2: 0 });
      }
    } catch (error) {
      console.error("Error updating score:", error);
    }
  };

  const recordResult = async (winner, loser, bothLose = false) => {
    if (!selectedArea) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/queue/${encodeURIComponent(selectedArea)}/game-result`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winner, loser, bothLose }),
        }
      );
      if (res.ok) {
        await fetchQueue();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to record result");
      }
    } catch (error) {
      console.error("Error recording result:", error);
      alert("Failed to record result");
    } finally {
      setLoading(false);
    }
  };

  const handleOnDragEnd = async (result) => {
    if (!result.destination) return; // Dropped outside the list

    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;

    if (sourceIndex === destinationIndex) return;

    // 1. Reorder local state immediately (Optimistic UI)
    const newTeams = Array.from(teams);
    const [reorderedItem] = newTeams.splice(sourceIndex, 1);
    newTeams.splice(destinationIndex, 0, reorderedItem);

    setTeams(newTeams);

    // 2. Sync with Backend
    // You will need to create this endpoint on your backend!
    try {
      await fetch(
        `${API_BASE}/queue/${encodeURIComponent(selectedArea)}/reorder`,
        {
          method: "POST", // or PUT
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teams: newTeams }),
        }
      );
    } catch (error) {
      console.error("Failed to save queue order", error);
      // Optional: revert state on error
      fetchQueue();
    }
  };

  return (
    <>
      {backendDown && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl z-50 text-center animate-fadeIn">
          ⚠️ Unable to connect to server — contact @CloseZad on IG to start
          server
        </div>
      )}

      {/* Full Screen Score View */}
      {showScoreView && inPlay.length === 2 && mode === "classic" && (
        <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-800 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl">
            <div className="grid grid-cols-2 gap-8">
              {/* Team 1 Score */}
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-light text-white mb-2 break-words whitespace-normal leading-tight">
                    {inPlay[0].name}
                  </h3>
                  <div className="text-9xl font-black text-emerald-400 mb-6 drop-shadow-2xl">
                    {score.team1 || 0}
                  </div>
                </div>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() =>
                      updateScore(
                        Math.max(0, (score.team1 || 0) - 1),
                        score.team2 || 0
                      )
                    }
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-md w-16 h-16 rounded-2xl font-bold text-3xl text-white border-2 border-white/40 shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
                  >
                    −
                  </button>
                  <button
                    onClick={() =>
                      updateScore((score.team1 || 0) + 1, score.team2 || 0)
                    }
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-md w-16 h-16 rounded-2xl font-bold text-3xl text-white border-2 border-white/40 shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Team 2 Score */}
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-8 border border-white/20">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-light text-white mb-2 break-words whitespace-normal leading-tight">
                    {inPlay[1].name}
                  </h3>
                  <div className="text-9xl font-black text-emerald-400 mb-6 drop-shadow-2xl">
                    {score.team2 || 0}
                  </div>
                </div>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() =>
                      updateScore(
                        score.team1 || 0,
                        Math.max(0, (score.team2 || 0) - 1)
                      )
                    }
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-md w-16 h-16 rounded-2xl font-bold text-3xl text-white border-2 border-white/40 shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
                  >
                    −
                  </button>
                  <button
                    onClick={() =>
                      updateScore(score.team1 || 0, (score.team2 || 0) + 1)
                    }
                    className="bg-white/20 hover:bg-white/30 backdrop-blur-md w-16 h-16 rounded-2xl font-bold text-3xl text-white border-2 border-white/40 shadow-lg transition-all duration-200 transform hover:scale-110 active:scale-95"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setShowScoreView(false)}
                className="bg-gradient-to-r from-slate-600 via-emerald-600 to-teal-600 text-white px-12 py-4 rounded-2xl font-bold shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-800 flex items-center justify-center p-2 sm:p-4 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-slate-600 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
        </div>

        <div className="w-full max-w-md h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 overflow-hidden relative z-10 flex flex-col">
          {/* Header - fixed */}
          <div className="bg-gradient-to-r from-slate-700 via-emerald-600 to-teal-600 px-6 py-5 text-white relative overflow-hidden flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
            <h1 className="text-2xl sm:text-3xl font-bold text-center relative z-10 tracking-tight">
              Pickup Tracker
            </h1>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-slate-600"></div>
          </div>

          {/* Scrollable Content */}
          <div className="overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 bg-gradient-to-b from-white/5 to-white/10 flex-1">
            {/* Area Selection / Session Creation */}
            {!sessionCreated && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-2xl font-bold mb-6 text-white text-center tracking-tight">
                    {isCreatingNew ? "Start New Session" : "Join Session"}
                  </h2>
                  <div className="space-y-5">
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-sm font-semibold text-white/90 tracking-wide">
                          {isCreatingNew ? "Location Name" : "Select Location"}
                        </label>
                        <button
                          onClick={() => {
                            setIsCreatingNew(!isCreatingNew);
                            setSelectedArea(null);
                            setCustomAreaName("");
                          }}
                          className="text-xs font-bold text-emerald-300 hover:text-emerald-100 transition-colors bg-white/10 px-3 py-1 rounded-full border border-white/20"
                        >
                          {isCreatingNew
                            ? "Existing Sessions"
                            : "+ New Location"}
                        </button>
                      </div>

                      {isCreatingNew ? (
                        <input
                          type="text"
                          placeholder="e.g. South Court"
                          value={customAreaName}
                          onChange={(e) => {
                            setCustomAreaName(e.target.value);
                            // REMOVED: setSelectedArea(e.target.value);
                          }}
                          className="w-full px-5 py-3.5 bg-white border-2 border-white/30 rounded-2xl ..."
                        />
                      ) : (
                        <select
                          value={selectedArea || ""}
                          onChange={(e) => setSelectedArea(e.target.value)}
                          className="w-full px-5 py-3.5 bg-white border-2 border-white/30 rounded-2xl focus:ring-4 focus:ring-emerald-500/50 focus:border-emerald-400 text-gray-800 font-medium shadow-lg transition-all hover:bg-white"
                        >
                          <option value="">-- Select Active Area --</option>
                          {areas.map((area) => (
                            <option key={area} value={area}>
                              {area}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {(selectedArea ||
                      (isCreatingNew && customAreaName.trim())) && (
                      <div className="animate-slideDown">
                        <label className="block text-sm font-semibold text-white/90 mb-3 tracking-wide">
                          Game Mode
                        </label>
                        <select
                          value={mode}
                          onChange={(e) => setMode(e.target.value)}
                          className="w-full px-5 py-3.5 bg-white/95 backdrop-blur-sm border-2 border-white/30 rounded-2xl focus:ring-4 focus:ring-emerald-500/50 focus:border-emerald-400 text-gray-800 font-medium shadow-lg transition-all"
                        >
                          <option value="">-- Select Mode --</option>
                          <option value="winner-stays-on">
                            Winner Stays On
                          </option>
                          <option value="classic">Classic</option>
                        </select>
                      </div>
                    )}

                    {(selectedArea ||
                      (isCreatingNew && customAreaName.trim())) &&
                      mode && (
                        <button
                          onClick={createSession}
                          disabled={loading}
                          className="w-full bg-gradient-to-r from-slate-600 via-emerald-600 to-teal-600 text-white py-4 rounded-2xl font-bold shadow-2xl hover:shadow-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-[1.02] relative overflow-hidden group"
                        >
                          <span className="relative z-10">
                            {loading
                              ? "Initializing..."
                              : isCreatingNew
                              ? "Create Session"
                              : "Join Session"}
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                        </button>
                      )}
                  </div>
                </div>
              </div>
            )}

            {/* Session Active UI */}
            {sessionCreated && (
              <div className="space-y-6 animate-fadeIn">
                {/* In-Play Teams */}
                <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 rounded-3xl shadow-2xl p-6 text-white relative overflow-hidden border border-white/20">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-50"></div>
                  <div className="relative z-10">
                    <h2 className="text-xl font-bold mb-5 text-center tracking-tight flex items-center justify-center gap-2">
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                      Currently In Play
                      <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    </h2>
                    {inPlay.length === 0 ? (
                      <p className="text-center text-white/80 py-6 text-lg">
                        No game in progress
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 mb-5">
                        {inPlay.map((team, idx) => (
                          <div
                            key={team.id}
                            className="bg-white/25 backdrop-blur-md rounded-2xl p-5 text-center border-2 border-white/40 shadow-xl transform transition-all duration-300 hover:scale-105"
                          >
                            <div className="text-2xl font-light break-words mb-2 drop-shadow-lg whitespace-normal leading-tight">
                              {team.name}
                            </div>
                            <div className="text-xs font-semibold text-white/90 bg-white/20 px-3 py-1 rounded-full inline-block">
                              Team {idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Controls for Winner Stays On */}
                    {inPlay.length === 2 && mode === "winner-stays-on" && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() =>
                              recordResult(inPlay[0].id, inPlay[1].id)
                            }
                            disabled={loading}
                            className="bg-white/25 hover:bg-white/35 backdrop-blur-md py-3 px-4 rounded-2xl font-light disabled:opacity-50 text-sm border-2 border-white/40 shadow-lg transition-all transform hover:scale-105 active:scale-95 break-words"
                          >
                            {inPlay[0].name} Wins
                          </button>
                          <button
                            onClick={() =>
                              recordResult(inPlay[1].id, inPlay[0].id)
                            }
                            disabled={loading}
                            className="bg-white/25 hover:bg-white/35 backdrop-blur-md py-3 px-4 rounded-2xl font-light disabled:opacity-50 text-sm border-2 border-white/40 shadow-lg transition-all transform hover:scale-105 active:scale-95 break-words"
                          >
                            {inPlay[1].name} Wins
                          </button>
                        </div>
                        <button
                          onClick={() => recordResult(null, null, true)}
                          disabled={loading}
                          className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-md py-3 px-4 rounded-2xl font-semibold border-2 border-white/30 shadow-lg"
                        >
                          Both Teams Go to Queue
                        </button>
                      </div>
                    )}

                    {/* Controls for Classic Mode */}
                    {inPlay.length === 2 && mode === "classic" && (
                      <div className="space-y-3">
                        <button
                          onClick={() => setShowScoreView(true)}
                          className="w-full bg-white/25 hover:bg-white/35 backdrop-blur-md py-3 px-4 rounded-2xl font-bold text-sm border-2 border-white/40 shadow-lg transition-all transform hover:scale-105 active:scale-95"
                        >
                          View Score
                        </button>
                        <button
                          onClick={() => recordResult(null, null, true)}
                          disabled={loading}
                          className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-md py-3 px-4 rounded-2xl font-semibold border-2 border-white/30 shadow-lg"
                        >
                          End Game
                        </button>
                      </div>
                    )}

                    {inPlay.length < 2 && teams.length >= 2 && (
                      <button
                        onClick={startGame}
                        disabled={loading}
                        className="w-full mt-5 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 py-4 px-6 rounded-2xl font-bold disabled:opacity-50 shadow-2xl text-white border-2 border-white/30 transition-all transform hover:scale-105"
                      >
                        Start Game
                      </button>
                    )}
                  </div>
                </div>

                {/* Queue Section */}
                <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl p-6 border border-white/20">
                  <h2 className="text-xl font-bold mb-5 text-white tracking-tight">
                    Queue
                  </h2>
                  <div className="mb-5 flex gap-3">
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && addTeam()}
                      placeholder="Enter team name"
                      className="flex-1 px-5 py-3.5 bg-white/95 border-2 border-white/30 rounded-2xl focus:ring-4 focus:ring-emerald-500/50 text-gray-800 font-medium shadow-lg"
                    />
                    <button
                      onClick={addTeam}
                      disabled={loading || !newTeamName.trim()}
                      className="bg-gradient-to-r from-slate-600 via-emerald-600 to-teal-600 text-white px-6 py-3.5 rounded-2xl font-bold shadow-xl transition-all transform hover:scale-105 active:scale-95"
                    >
                      Add
                    </button>
                  </div>

                  {teams.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-white/60 text-lg">No teams in queue</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto -mx-6 px-6">
                      <div className="bg-white/5 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10">
                        {teams.length === 0 ? (
                          <div className="text-center py-12">
                            <p className="text-white/60 text-lg">
                              No teams in queue
                            </p>
                          </div>
                        ) : (
                          <div className="bg-white/5 backdrop-blur-sm rounded-2xl overflow-hidden border border-white/10">
                            {/* Header Row */}
                            <div className="grid grid-cols-[3rem_1fr_auto] gap-4 border-b border-white/20 bg-white/5 p-4">
                              <div className="font-bold text-white/90 text-xs uppercase">
                                #
                              </div>
                              <div className="font-bold text-white/90 text-xs uppercase">
                                Team Name
                              </div>
                              <div className="font-bold text-white/90 text-xs uppercase text-right">
                                Actions
                              </div>
                            </div>

                            {/* Draggable List */}
                            <DragDropContext onDragEnd={handleOnDragEnd}>
                              <Droppable droppableId="queue-list">
                                {(provided) => (
                                  <div
                                    {...provided.droppableProps}
                                    ref={provided.innerRef}
                                    className="divide-y divide-white/10"
                                  >
                                    {teams.map((team, index) => (
                                      <Draggable
                                        key={team.id}
                                        draggableId={String(team.id)}
                                        index={index}
                                      >
                                        {(provided, snapshot) => (
                                          <div
                                            ref={provided.innerRef}
                                            {...provided.draggableProps}
                                            {...provided.dragHandleProps}
                                            className={`grid grid-cols-[3rem_1fr_auto] gap-4 p-4 items-center transition-colors ${
                                              snapshot.isDragging
                                                ? "bg-emerald-600/50 shadow-xl ring-2 ring-emerald-400 z-50 rounded-lg"
                                                : "hover:bg-white/10"
                                            }`}
                                            style={{
                                              ...provided.draggableProps.style, // Required for positioning
                                            }}
                                          >
                                            {/* Index Column with Grip Icon */}
                                            <div className="flex items-center gap-2 text-white/80 font-bold text-lg cursor-grab active:cursor-grabbing">
                                              {/* Grip Icon */}
                                              <svg
                                                className="w-4 h-4 opacity-50"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M4 8h16M4 16h16"
                                                />
                                              </svg>
                                              {index + 1}
                                            </div>

                                            {/* Name Column */}
                                            <div className="text-white font-light text-base">
                                              {team.name}
                                            </div>

                                            {/* Actions Column */}
                                            <div className="text-right">
                                              <button
                                                onClick={() =>
                                                  removeTeam(team.id)
                                                }
                                                disabled={loading}
                                                className="text-red-400 hover:text-red-300 font-bold text-sm transition-all hover:scale-110"
                                                // Prevent drag when clicking button
                                                onMouseDown={(e) =>
                                                  e.stopPropagation()
                                                }
                                              >
                                                Remove
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))}
                                    {provided.placeholder}
                                  </div>
                                )}
                              </Droppable>
                            </DragDropContext>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Session Footer Info */}
                <div className="text-center text-sm text-white/70 space-y-2 pb-2">
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-semibold text-white/50">Area:</span>
                    <span className="font-bold text-white">{selectedArea}</span>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <span className="font-semibold text-white/50">Mode:</span>
                    <span className="font-bold text-white">
                      {mode === "winner-stays-on"
                        ? "Winner Stays On"
                        : mode === "classic"
                        ? "Classic"
                        : mode}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSessionCreated(false);
                      setSelectedArea(null);
                    }}
                    className="text-xs text-emerald-400 underline mt-2 opacity-60 hover:opacity-100"
                  >
                    Change Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
