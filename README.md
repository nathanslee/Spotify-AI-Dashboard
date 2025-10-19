# Spotify AI Dashboard - Your Music DNA

A beautiful, minimalist AI-powered dashboard that reveals deep insights into your Spotify listening habits using AI-powered pattern detection and statistical analysis.

![Spotify Analytics Dashboard](https://img.shields.io/badge/Spotify-Analytics-1DB954?style=for-the-badge&logo=spotify&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=for-the-badge&logo=openai&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)

## ✨ Features

### 📊 Statistical Analytics
- **Audio Feature Analysis**: Energy, valence, danceability, tempo, acousticness with interactive tooltips
- **Temporal Patterns**: When you listen, hourly and daily breakdowns with beautiful charts
- **Top Artists & Genres**: Your most-played artists and favorite genres with album art
- **Recently Played Timeline**: Track-by-track listening history with timestamps
- **Diversity Metrics**: Artist diversity, genre variety, listening velocity

### 🤖 AI-Powered Insights

#### 1. Habit Detection Pattern
Uses **GPT-4o-mini** to analyze your listening data and detect 3-5 specific behavioral patterns:
- **Temporal Habits**: Time-based patterns (morning energy boost, late-night chill)
- **Mood Habits**: Emotional preferences in music selection
- **Genre Habits**: Loyalty vs exploration tendencies
- **Behavioral Habits**: Context clues about how you use music

Each habit includes:
- Catchy, specific title
- Detailed 2-3 sentence description
- Confidence score (0-100%) with visual progress bar
- Color-coded category classification

#### 2. Persona Analysis Pattern
Creates a rich, personalized listener profile using **GPT-4o-mini**:
- **Archetype**: Creative 2-3 word persona (e.g., "Melancholic Explorer", "Energetic Curator")
- **Personality**: Deep dive into your music personality and psychological profile
- **Listening Style**: How you use music (background, focus, emotional regulation)
- **Personalized Recommendations**: 3 specific, actionable suggestions for music discovery

### 🎨 UI/UX Features
- **Custom Cursor Follower**: Smooth green glowing dot that follows your cursor
- **Interactive Tooltips**: Hover over "?" icons to learn what each metric means
- **Spotify Design System**: Official colors, glass morphism, smooth animations
- **Responsive Charts**: Chart.js visualizations with radar, bar, and line charts
- **Dark Theme**: Easy on the eyes with Spotify's signature dark aesthetic

### Visualizations

All charts use minimalist Spotify-themed design with different accent colors:

1. **Top Genres** - Bar chart (Spotify Green)
2. **Listening by Hour** - Line chart (Accent Blue)
3. **Audio Features** - Radar chart (Accent Purple)
4. **Mood Distribution** - Doughnut chart (Multi-color)
5. **Top Artists** - List with popularity scores

## Tech Stack

### Backend
- **Node.js + Express**: API server with Spotify OAuth
- **Python**: Statistical analysis engine
  - NumPy: Numerical computations
  - Pandas: Time-series analysis
  - Statistical calculations
- **OpenAI GPT-4o-mini**: AI pattern detection

### Frontend
- **Vanilla JavaScript**: No frameworks, pure performance
- **Chart.js**: Beautiful, responsive charts
- **Spotify Design System**: Official colors and styling

### Data Processing Flow
```
Spotify API → Express Backend → Python Analytics → AI Analysis → Chart.js Visualizations
```

## Setup

### Prerequisites
- Node.js v14+
- Python 3.11+
- OpenAI API key
- Spotify Developer account

### Installation

1. **Ensure all packages are installed** (already done):
   ```bash
   npm install chart.js plotly.js-dist d3
   pip install numpy pandas matplotlib seaborn plotly scikit-learn scipy
   ```

2. **Configure Spotify App** (if not already done):
   - Go to https://developer.spotify.com/dashboard
   - Ensure Redirect URI includes: `http://127.0.0.1:3000/callback`

3. **Environment Variables** (already configured in `.env`):
   ```
   OPENAI_API_KEY=your-key
   SPOTIFY_CLIENT_ID=your-id
   SPOTIFY_CLIENT_SECRET=your-secret
   SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback
   ```

### Running the App

1. **Start the server**:
   ```bash
   node server.js
   ```
   You should see: `🎧 Spotify Analytics Server running on http://localhost:3000`

2. **Open the dashboard**:
   - Navigate to: `http://127.0.0.1:3000/index.html`

3. **Sign in with Spotify**:
   - Click "Sign in with Spotify"
   - Authorize the app
   - Explore your music analytics!

**Note**: The app will show an account selection dialog every time you sign in, allowing you to easily switch between Spotify accounts.

## How It Works

### Data Collection
1. User authenticates via Spotify OAuth
2. Backend fetches:
   - Last 50 recently played tracks
   - Top 50 tracks (medium-term)
   - Top 50 artists (medium-term)
   - Audio features for all unique tracks

### Analysis Pipeline

#### Python Analytics Engine (`analyze.py`)
Computes:
- **Statistical summaries**: Mean, median, std dev for audio features
- **Top lists**: Most-played artists and genres
- **Temporal analysis**: Hourly/daily patterns, energy by time
- **Mood classification**: % of tracks that are energetic, calm, happy, sad, danceable
- **Diversity score**: Herfindahl index of genre variety

#### AI Pattern Detection (`/api/ai/habits`)
Prompt engineering pattern that:
1. Receives statistical data
2. Analyzes for behavioral patterns
3. Returns 3-5 specific habits with confidence scores
4. Categorizes each habit (temporal, mood, genre, behavior)

#### AI Persona Analysis (`/api/ai/persona`)
Creative prompt pattern that:
1. Synthesizes listening data into personality traits
2. Creates a unique archetype name
3. Describes listening style and personality
4. Generates personalized music recommendations

### Visualization
- Chart.js renders interactive, responsive charts
- Spotify color palette with accent colors for different data types
- Minimalist design with smooth animations
- Mobile-responsive grid layout

## Color Palette

```css
Spotify Green: #1DB954 (primary actions, accents)
Spotify Black: #191414 (background)
Dark Gray: #282828 (cards)
Light Gray: #b3b3b3 (text)
Accent Blue: #509BF5 (temporal data)
Accent Purple: #9D4EDD (features, persona)
Accent Orange: #FF6B35 (energy, moods)
Accent Pink: #FF006E (special highlights)
```

## API Endpoints

### `POST /api/analytics`
Fetches and analyzes user listening data
- **Request**: `{ sessionId: string }`
- **Response**:
  ```json
  {
    "analytics": { /* all computed metrics */ },
    "top_artists": [ /* artist data with images */ ]
  }
  ```

### `POST /api/ai/habits`
AI-powered habit detection
- **Request**: `{ analytics: object, sessionId: string }`
- **Response**:
  ```json
  {
    "habits": [
      {
        "title": "Morning Energy Boost",
        "description": "...",
        "confidence": 85,
        "category": "temporal"
      }
    ]
  }
  ```

### `POST /api/ai/persona`
AI-generated listener persona
- **Request**: `{ analytics: object, sessionId: string }`
- **Response**:
  ```json
  {
    "persona": {
      "archetype": "Melancholic Explorer",
      "personality": "...",
      "listening_style": "...",
      "recommendations": ["...", "...", "..."]
    }
  }
  ```

## 📁 Project Structure

```
index.html          # Minimalist dashboard UI with custom cursor & tooltips
server.js           # Express backend with AI endpoints & Spotify OAuth
analyze.py          # Python statistical analysis engine (optional)
.env                # API credentials (Spotify + OpenAI)
package.json        # Node dependencies
README.md           # This file
```

## Metrics Explained

### Diversity Score (0-100)
- Calculated using inverted Herfindahl index
- Higher = more varied taste across artists/genres
- Lower = focused on fewer artists/genres

### Audio Features
- **Energy** (0-1): Intensity and activity
- **Valence** (0-1): Musical positiveness (happy vs sad)
- **Danceability** (0-1): How suitable for dancing
- **Tempo** (BPM): Speed of the track
- **Acousticness** (0-1): Acoustic vs electronic

### Mood Distribution
Percentage of tracks that match each mood:
- **Energetic**: Energy > 0.6
- **Calm**: Energy < 0.4
- **Happy**: Valence > 0.6
- **Sad**: Valence < 0.4
- **Danceable**: Danceability > 0.7

## 🧠 AI Prompt Engineering Patterns

This project uses carefully crafted prompt patterns to extract meaningful insights from listening data. Below are the templates and patterns used:

### Habit Detection Prompt Pattern

**Pattern Type**: Structured Analysis with Constrained Output

**System Prompt**:
```
You are a music psychology expert analyzing listening patterns. Always respond with valid JSON only.
```

**User Prompt Template**:
```
Analyze this Spotify listening data and identify 3-5 specific behavioral patterns or habits.

For each habit, provide:
- title: A catchy, specific name (e.g., "Morning Energy Boost" not "Likes energetic music")
- description: 2-3 sentences explaining the pattern and what it reveals
- confidence: A score 0-100 indicating how strong this pattern is
- category: One of [temporal, mood, genre, behavior]

Listening Data:
- Audio Profile: Energy X%, Danceability Y%, Positivity Z%, Acousticness W%
- Top Genres: [genres list]
- Artist Diversity: X%
- Time Patterns: Peak hour H, Peak day D
- Tracks per day: X

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
}
```

**Key Pattern Elements**:
1. **Specificity Instruction**: "catchy, specific name" with example to avoid generic outputs
2. **Structured Output**: Clear JSON schema prevents hallucination
3. **Confidence Scoring**: Forces AI to assess pattern strength
4. **Category Classification**: Limits creative freedom to maintain consistency
5. **No Markdown**: Explicitly prevents ```json``` wrappers for easier parsing

### Persona Analysis Prompt Pattern

**Pattern Type**: Creative Synthesis with Bounded Creativity

**System Prompt**:
```
You are a music psychology expert creating listener personas. Always respond with valid JSON only.
```

**User Prompt Template**:
```
Create a detailed music listener persona based on this Spotify data.

Listening Data:
- Audio Profile: Energy X%, Danceability Y%, Positivity Z%, Acousticness W%
- Top Genres: [genres list]
- Top Artists: [artists list]
- Artist Diversity: X%
- Loyalty Score: Y%
- Mainstream Score: Z/100
- Peak listening: Day at Hour:00

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
}
```

**Key Pattern Elements**:
1. **Bounded Creativity**: "2-3 word" constraint with examples
2. **Length Control**: Sentence count limits prevent rambling
3. **Specific vs Generic**: "specific, actionable" recommendations vs vague suggestions
4. **Example-Driven**: Examples like "Melancholic Explorer" guide tone and style
5. **Array Structure**: Forces exactly 3 recommendations, not more/less

### Prompt Engineering Principles Used

1. **Role Assignment**: "You are a music psychology expert" establishes expertise
2. **Output Format Enforcement**: "Always respond with valid JSON only" prevents format drift
3. **Few-Shot Learning**: Examples show desired output style without full training data
4. **Constraint-Based Generation**: Limits (word counts, categories) prevent hallucination
5. **Explicit Anti-Patterns**: "no markdown, no code blocks" prevents common AI formatting
6. **Data Contextualization**: Providing all metrics gives AI full context for analysis
7. **Temperature Tuning**:
   - Habits: 0.7 (balanced creativity/consistency)
   - Persona: 0.8 (more creative for unique archetypes)

### Response Parsing Strategy

```javascript
// Clean markdown code blocks if AI ignores instructions
const responseText = completion.choices[0].message.content.trim();
const jsonText = responseText
  .replace(/```json\n?/g, '')
  .replace(/```\n?/g, '')
  .trim();
const result = JSON.parse(jsonText);
```

This defensive parsing handles cases where the AI adds markdown despite instructions.

## 🔮 Future Enhancements

- [ ] Time-range selector (4 weeks, 6 months, all time)
- [ ] Export analytics as PDF/PNG
- [ ] Comparison with friends
- [ ] Predictive models (next likely song/genre)
- [ ] Playlist generation based on insights
- [ ] Historical trend tracking
- [ ] Advanced visualizations (calendar heatmap, network graphs)
- [ ] Sentiment analysis of lyrics
- [ ] Concert recommendations based on listening habits

## 🙏 Credits

Built with:
- **Spotify Web API** for music data
- **OpenAI GPT-4o-mini** for AI insights
- **Chart.js** for visualizations
- **Node.js + Express** for backend
- **Vanilla JavaScript** for frontend (no frameworks!)

Designed with Spotify's official color palette and minimalist aesthetic.

## 📝 Notes

- **Audio Features 403 Error**: If your Spotify app is in Development mode, audio features may return 403. The app gracefully handles this by using sensible defaults.
- **Account Switching**: The `show_dialog: true` parameter forces Spotify to show the authorization dialog every time, making it easy to switch accounts.
- **Development Mode**: Remember to add your Spotify account to the app's allowed users in the Spotify Developer Dashboard.

---

**Enjoy discovering your Music DNA! 🎵**
