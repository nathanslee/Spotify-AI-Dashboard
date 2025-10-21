// ---------- IMPORTS ----------
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch";
import OpenAI from "openai";
import crypto from "crypto";

// ---------- CONFIGURATION ----------
dotenv.config({ path: "./.env" });

const app = express();
app.use(cors({
  origin: ["http://127.0.0.1:3000", "http://localhost:3000"],
  credentials: true
}));
app.use(express.json());
app.use(express.static('.'));

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Session storage for user tokens
const userSessions = new Map();

// Persistent user cache (survives sign-out/sign-in) - keyed by Spotify user ID
const userCache = new Map();

// ---------- HELPER FUNCTIONS ----------

// Generate a hash from analytics data to detect changes
function generateDataHash(analytics) {
  const relevantData = {
    topArtists: analytics.overview?.topArtists?.slice(0, 10).map(a => a.name),
    topGenres: analytics.overview?.topGenres?.slice(0, 5).map(g => g.name),
    audioProfile: analytics.overview?.audioProfile,
    variety: analytics.habits?.variety,
    timePatterns: analytics.habits?.timePatterns,
    velocity: analytics.habits?.velocity,
    loyaltyScore: analytics.persona?.loyaltyScore,
    mainstreamScore: analytics.persona?.mainstreamScore
  };

  return crypto.createHash('sha256')
    .update(JSON.stringify(relevantData))
    .digest('hex');
}

// ---------- SPOTIFY HELPER FUNCTIONS ----------

async function getSpotifyUserToken(code) {
  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
  });

  return await res.json();
}

async function refreshSpotifyToken(refreshToken) {
  const auth = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  return await res.json();
}

async function spotifyRequest(endpoint, accessToken) {
  const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Spotify API error on ${endpoint}:`, res.status, errorBody);
    throw new Error(`Spotify API error: ${res.status} - ${errorBody}`);
  }

  return await res.json();
}

// ---------- SPOTIFY OAUTH ROUTES ----------

app.get("/login", (req, res) => {
  const scope = "user-read-recently-played user-top-read user-read-private user-read-email";
  const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
    response_type: "code",
    client_id: process.env.SPOTIFY_CLIENT_ID,
    scope: scope,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    show_dialog: "true"  // Force account selection dialog every time
  })}`;

  res.redirect(authUrl);
});

app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    console.error("Spotify OAuth error:", error);
    return res.status(400).send(`Spotify authorization error: ${error}`);
  }

  if (!code) {
    return res.status(400).send("Authorization code missing");
  }

  try {
    console.log("Exchanging authorization code for access token...");
    const tokenData = await getSpotifyUserToken(code);

    if (!tokenData.access_token) {
      console.error("No access token received:", tokenData);
      return res.status(500).send("Failed to get access token from Spotify");
    }

    // Fetch user profile to get Spotify user ID
    const userProfile = await spotifyRequest('/me', tokenData.access_token);
    const spotifyUserId = userProfile.id;

    console.log("✅ User authenticated:", spotifyUserId);

    // Initialize persistent cache for this user if it doesn't exist
    if (!userCache.has(spotifyUserId)) {
      userCache.set(spotifyUserId, {
        dataHash: null,
        habits: null,
        persona: null,
        lastUpdated: null
      });
      console.log("🆕 Created new user cache for:", spotifyUserId);
    } else {
      console.log("♻️  Existing user cache found for:", spotifyUserId);
    }

    const sessionId = Math.random().toString(36).substring(7);

    userSessions.set(sessionId, {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      spotifyUserId: spotifyUserId  // Link session to user's persistent cache
    });

    console.log("✅ Session created:", sessionId);
    res.redirect(`http://127.0.0.1:3000/index.html?session=${sessionId}`);
  } catch (error) {
    console.error("OAuth error:", error);
    res.status(500).send(`Authentication failed: ${error.message}`);
  }
});

// ---------- ANALYTICS API ROUTE ----------

app.post("/api/analytics", async (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId || !userSessions.has(sessionId)) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  try {
    let session = userSessions.get(sessionId);

    // Refresh token if expired
    if (Date.now() >= session.expires_at) {
      const tokenData = await refreshSpotifyToken(session.refresh_token);
      session.access_token = tokenData.access_token;
      session.expires_at = Date.now() + tokenData.expires_in * 1000;
      userSessions.set(sessionId, session);
    }

    const accessToken = session.access_token;

    console.log('Fetching Spotify data...');

    // Fetch all data in parallel
    const [recentTracks, topTracksShort, topTracksMedium, topTracksLong, topArtistsShort, topArtistsMedium, topArtistsLong] = await Promise.all([
      spotifyRequest('/me/player/recently-played?limit=50', accessToken),
      spotifyRequest('/me/top/tracks?time_range=short_term&limit=50', accessToken),
      spotifyRequest('/me/top/tracks?time_range=medium_term&limit=50', accessToken),
      spotifyRequest('/me/top/tracks?time_range=long_term&limit=50', accessToken),
      spotifyRequest('/me/top/artists?time_range=short_term&limit=50', accessToken),
      spotifyRequest('/me/top/artists?time_range=medium_term&limit=50', accessToken),
      spotifyRequest('/me/top/artists?time_range=long_term&limit=50', accessToken)
    ]);

    console.log('Successfully fetched Spotify data');

    // Get audio features for top tracks (handle gracefully if fails)
    let audioFeatures = { audio_features: [] };
    try {
      const trackIds = [...new Set([
        ...topTracksShort.items.map(t => t.id),
      ])].filter(id => id).slice(0, 50); // Limit to 50 tracks to avoid quota issues

      if (trackIds.length > 0) {
        audioFeatures = await spotifyRequest(`/audio-features?ids=${trackIds.join(',')}`, accessToken);
        console.log('✅ Successfully fetched audio features');
      }
    } catch (error) {
      console.warn('⚠️  Audio features unavailable (403 - app in development mode). Continuing without audio analysis...');
      // Continue without audio features - app will still work
    }

    // Process the data
    const analytics = processAnalytics({
      recentTracks,
      topTracksShort,
      topTracksMedium,
      topTracksLong,
      topArtistsShort,
      topArtistsMedium,
      topArtistsLong,
      audioFeatures
    });

    res.json(analytics);

  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to generate analytics" });
  }
});

function processAnalytics(data) {
  const result = {
    overview: {},
    habits: {},
    persona: {}
  };

  // OVERVIEW PAGE DATA
  result.overview.topArtists = data.topArtistsShort.items.slice(0, 10).map((artist, idx) => ({
    rank: idx + 1,
    name: artist.name,
    image: artist.images[0]?.url,
    genres: artist.genres,
    popularity: artist.popularity
  }));

  result.overview.topTracks = data.topTracksShort.items.slice(0, 10).map((track, idx) => ({
    rank: idx + 1,
    name: track.name,
    artist: track.artists.map(a => a.name).join(', '),
    album: track.album.name,
    image: track.album.images[0]?.url,
    popularity: track.popularity,
    duration_ms: track.duration_ms
  }));

  // Recently played
  const recentItems = data.recentTracks.items || [];
  result.overview.recentlyPlayed = recentItems.slice(0, 20).map(item => ({
    name: item.track.name,
    artist: item.track.artists.map(a => a.name).join(', '),
    played_at: item.played_at,
    image: item.track.album.images[2]?.url || item.track.album.images[0]?.url
  }));

  // Audio features analysis (if available)
  const features = (data.audioFeatures?.audio_features || []).filter(f => f !== null);
  if (features.length > 0) {
    result.overview.audioProfile = {
      energy: Math.round((features.reduce((sum, f) => sum + f.energy, 0) / features.length) * 100),
      danceability: Math.round((features.reduce((sum, f) => sum + f.danceability, 0) / features.length) * 100),
      valence: Math.round((features.reduce((sum, f) => sum + f.valence, 0) / features.length) * 100),
      acousticness: Math.round((features.reduce((sum, f) => sum + f.acousticness, 0) / features.length) * 100),
      instrumentalness: Math.round((features.reduce((sum, f) => sum + f.instrumentalness, 0) / features.length) * 100),
      speechiness: Math.round((features.reduce((sum, f) => sum + f.speechiness, 0) / features.length) * 100),
      tempo: Math.round(features.reduce((sum, f) => sum + f.tempo, 0) / features.length)
    };
  } else {
    // Fallback: Use default values when audio features aren't available
    result.overview.audioProfile = {
      energy: 65,
      danceability: 60,
      valence: 55,
      acousticness: 30,
      instrumentalness: 15,
      speechiness: 10,
      tempo: 120
    };
  }

  // Genre analysis
  const allGenres = {};
  [...data.topArtistsShort.items, ...data.topArtistsMedium.items].forEach(artist => {
    artist.genres.forEach(genre => {
      allGenres[genre] = (allGenres[genre] || 0) + 1;
    });
  });
  result.overview.topGenres = Object.entries(allGenres)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // HABITS PAGE DATA
  // Listening time patterns from recently played
  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);

  recentItems.forEach(item => {
    const date = new Date(item.played_at);
    hourCounts[date.getHours()]++;
    dayCounts[date.getDay()]++;
  });

  result.habits.timePatterns = {
    hourly: hourCounts,
    daily: dayCounts,
    mostActiveHour: hourCounts.indexOf(Math.max(...hourCounts)),
    mostActiveDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayCounts.indexOf(Math.max(...dayCounts))]
  };

  // Track variety analysis
  const uniqueArtistsShort = new Set(data.topTracksShort.items.map(t => t.artists[0]?.id)).size;
  const uniqueArtistsLong = new Set(data.topTracksLong.items.map(t => t.artists[0]?.id)).size;

  result.habits.variety = {
    artistDiversity: Math.round((uniqueArtistsShort / data.topTracksShort.items.length) * 100),
    genreDiversity: Object.keys(allGenres).length,
    consistency: Math.round((uniqueArtistsShort / (uniqueArtistsLong || 1)) * 100)
  };

  // Listening velocity
  if (recentItems.length > 1) {
    const firstPlay = new Date(recentItems[recentItems.length - 1].played_at);
    const lastPlay = new Date(recentItems[0].played_at);
    const hoursDiff = (lastPlay - firstPlay) / (1000 * 60 * 60);

    result.habits.velocity = {
      tracksPerDay: hoursDiff > 0 ? Math.round((recentItems.length / hoursDiff) * 24 * 10) / 10 : 0,
      recentTrackCount: recentItems.length
    };
  }

  // PERSONA PAGE DATA
  result.persona.timeRangeComparison = {
    short: {
      topArtist: data.topArtistsShort.items[0]?.name || 'N/A',
      topTrack: data.topTracksShort.items[0]?.name || 'N/A',
      topGenre: result.overview.topGenres[0]?.name || 'N/A'
    },
    medium: {
      topArtist: data.topArtistsMedium.items[0]?.name || 'N/A',
      topTrack: data.topTracksMedium.items[0]?.name || 'N/A'
    },
    long: {
      topArtist: data.topArtistsLong.items[0]?.name || 'N/A',
      topTrack: data.topTracksLong.items[0]?.name || 'N/A'
    }
  };

  // Loyalty score - how many artists appear in multiple time ranges
  const shortArtists = new Set(data.topArtistsShort.items.slice(0, 10).map(a => a.id));
  const mediumArtists = new Set(data.topArtistsMedium.items.slice(0, 10).map(a => a.id));
  const longArtists = new Set(data.topArtistsLong.items.slice(0, 10).map(a => a.id));

  const loyalArtists = [...shortArtists].filter(id => mediumArtists.has(id) && longArtists.has(id));
  result.persona.loyaltyScore = Math.round((loyalArtists.length / 10) * 100);

  // Mainstream score - based on average popularity
  const avgPopularity = Math.round(
    data.topTracksShort.items.slice(0, 20).reduce((sum, t) => sum + t.popularity, 0) / 20
  );
  result.persona.mainstreamScore = avgPopularity;

  return result;
}

// ---------- AI-POWERED ENDPOINTS ----------

app.post("/api/ai/habits", async (req, res) => {
  const { analytics, sessionId } = req.body;

  if (!sessionId || !userSessions.has(sessionId)) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  try {
    const session = userSessions.get(sessionId);
    const spotifyUserId = session.spotifyUserId;
    const userCacheData = userCache.get(spotifyUserId);
    const currentDataHash = generateDataHash(analytics);

    // Check if we have cached habits and data hasn't changed
    if (userCacheData.habits && userCacheData.dataHash === currentDataHash) {
      console.log("✅ Returning cached AI habits (data unchanged) for user:", spotifyUserId);
      return res.json({ habits: userCacheData.habits });
    }

    console.log("🔄 Generating new AI habits (data changed or no cache) for user:", spotifyUserId);

    const prompt = `Analyze this Spotify listening data and identify 3-5 specific behavioral patterns or habits.

For each habit, provide:
- title: A catchy, specific name (e.g., "Morning Energy Boost" not "Likes energetic music")
- description: 2-3 sentences explaining the pattern and what it reveals
- confidence: A score 0-100 indicating how strong this pattern is
- category: One of [temporal, mood, genre, behavior]

Listening Data:
- Audio Profile: Energy ${analytics.overview?.audioProfile?.energy}%, Danceability ${analytics.overview?.audioProfile?.danceability}%, Positivity ${analytics.overview?.audioProfile?.valence}%, Acousticness ${analytics.overview?.audioProfile?.acousticness}%
- Top Genres: ${analytics.overview?.topGenres?.slice(0, 5).map(g => g.name).join(', ')}
- Artist Diversity: ${analytics.habits?.variety?.artistDiversity}%
- Time Patterns: Peak hour ${analytics.habits?.timePatterns?.mostActiveHour}, Peak day ${analytics.habits?.timePatterns?.mostActiveDay}
- Tracks per day: ${analytics.habits?.velocity?.tracksPerDay}

Respond with ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "habits": [
    {
      "title": "Habit name",
      "description": "Detailed description",
      "confidence": 85,
      "category": "temporal"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a music psychology expert analyzing listening patterns. Always respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 800
    });

    const responseText = completion.choices[0].message.content.trim();
    // Remove markdown code blocks if present
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(jsonText);

    // Cache the results in persistent user cache
    userCacheData.habits = result.habits;
    userCacheData.dataHash = currentDataHash;
    userCacheData.lastUpdated = Date.now();
    userCache.set(spotifyUserId, userCacheData);

    console.log("✅ AI habits cached successfully for user:", spotifyUserId);

    res.json(result);

  } catch (error) {
    console.error("AI Habits error:", error);
    res.status(500).json({ error: "Failed to generate habit insights" });
  }
});

app.post("/api/ai/persona", async (req, res) => {
  const { analytics, sessionId } = req.body;

  if (!sessionId || !userSessions.has(sessionId)) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }

  try {
    const session = userSessions.get(sessionId);
    const spotifyUserId = session.spotifyUserId;
    const userCacheData = userCache.get(spotifyUserId);
    const currentDataHash = generateDataHash(analytics);

    // Check if we have cached persona and data hasn't changed
    if (userCacheData.persona && userCacheData.dataHash === currentDataHash) {
      console.log("✅ Returning cached AI persona (data unchanged) for user:", spotifyUserId);
      return res.json({ persona: userCacheData.persona });
    }

    console.log("🔄 Generating new AI persona (data changed or no cache) for user:", spotifyUserId);

    const prompt = `Create a detailed music listener persona based on this Spotify data.

Listening Data:
- Audio Profile: Energy ${analytics.overview?.audioProfile?.energy}%, Danceability ${analytics.overview?.audioProfile?.danceability}%, Positivity ${analytics.overview?.audioProfile?.valence}%, Acousticness ${analytics.overview?.audioProfile?.acousticness}%
- Top Genres: ${analytics.overview?.topGenres?.slice(0, 5).map(g => g.name).join(', ')}
- Top Artists: ${analytics.overview?.topArtists?.slice(0, 5).map(a => a.name).join(', ')}
- Artist Diversity: ${analytics.habits?.variety?.artistDiversity}%
- Loyalty Score: ${analytics.persona?.loyaltyScore}%
- Mainstream Score: ${analytics.persona?.mainstreamScore}/100
- Peak listening: ${analytics.habits?.timePatterns?.mostActiveDay} at ${analytics.habits?.timePatterns?.mostActiveHour}:00

Provide:
- archetype: A creative 2-3 word persona name (e.g., "Melancholic Explorer", "Energetic Curator")
- personality: 3-4 sentences describing their music personality
- listening_style: 2-3 sentences about how they use music
- recommendations: Array of 3 specific, actionable music discovery suggestions

Respond with ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "persona": {
    "archetype": "Persona Name",
    "personality": "Description...",
    "listening_style": "Description...",
    "recommendations": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
  }
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a music psychology expert creating listener personas. Always respond with valid JSON only." },
        { role: "user", content: prompt }
      ],
      temperature: 0.8,
      max_tokens: 600
    });

    const responseText = completion.choices[0].message.content.trim();
    // Remove markdown code blocks if present
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(jsonText);

    // Cache the results in persistent user cache
    userCacheData.persona = result.persona;
    userCacheData.dataHash = currentDataHash;
    userCacheData.lastUpdated = Date.now();
    userCache.set(spotifyUserId, userCacheData);

    console.log("✅ AI persona cached successfully for user:", spotifyUserId);

    res.json(result);

  } catch (error) {
    console.error("AI Persona error:", error);
    res.status(500).json({ error: "Failed to generate persona insights" });
  }
});

// ---------- START SERVER ----------
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🎧 Spotify Analytics Server running on http://localhost:${PORT}`);
});
