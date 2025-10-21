"""
Spotify Analytics Engine - Enhanced Edition
Analyzes user listening data and computes comprehensive statistical metrics
"""

import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from collections import Counter
from itertools import combinations

def analyze_listening_data(data):
    """
    Main analysis function
    Args:
        data: dict with keys:
            - recent_tracks: list of recently played tracks
            - top_tracks: list of top tracks
            - audio_features: dict mapping track_id to audio features
    Returns:
        dict with all computed metrics
    """

    # Convert to DataFrames
    recent_df = pd.DataFrame(data.get('recent_tracks', []))
    top_df = pd.DataFrame(data.get('top_tracks', []))
    features = data.get('audio_features', {})

    # Extract audio features into a DataFrame
    features_list = []
    for track_id, feat in features.items():
        if feat:
            features_list.append({
                'track_id': track_id,
                'energy': feat.get('energy', 0),
                'valence': feat.get('valence', 0),
                'danceability': feat.get('danceability', 0),
                'tempo': feat.get('tempo', 0),
                'acousticness': feat.get('acousticness', 0),
                'instrumentalness': feat.get('instrumentalness', 0),
                'speechiness': feat.get('speechiness', 0),
                'liveness': feat.get('liveness', 0)
            })

    features_df = pd.DataFrame(features_list)

    # --- STATISTICAL SUMMARIES ---
    audio_stats = {}
    if not features_df.empty:
        for col in ['energy', 'valence', 'danceability', 'tempo', 'acousticness']:
            audio_stats[col] = {
                'mean': float(features_df[col].mean()),
                'median': float(features_df[col].median()),
                'std': float(features_df[col].std()),
                'min': float(features_df[col].min()),
                'max': float(features_df[col].max())
            }

    # --- TOP ARTISTS & GENRES ---
    top_artists = []
    top_genres = []

    if not top_df.empty:
        artist_counts = Counter()
        genre_counts = Counter()

        for _, track in top_df.iterrows():
            artists = track.get('artists', [])
            for artist in artists:
                artist_counts[artist.get('name', 'Unknown')] += 1
                for genre in artist.get('genres', []):
                    genre_counts[genre] += 1

        top_artists = [{'name': name, 'count': count} for name, count in artist_counts.most_common(10)]
        top_genres = [{'name': name, 'count': count} for name, count in genre_counts.most_common(10)]

    # --- TEMPORAL ANALYSIS ---
    temporal_patterns = {
        'hourly': [0] * 24,
        'daily': [0] * 7,
        'energy_by_hour': {}
    }

    if not recent_df.empty and 'played_at' in recent_df.columns:
        # Convert played_at to datetime
        recent_df['played_at'] = pd.to_datetime(recent_df['played_at'])
        recent_df['hour'] = recent_df['played_at'].dt.hour
        recent_df['day_of_week'] = recent_df['played_at'].dt.dayofweek

        # Count by hour
        hourly_counts = recent_df['hour'].value_counts().to_dict()
        for hour, count in hourly_counts.items():
            temporal_patterns['hourly'][hour] = int(count)

        # Count by day of week
        daily_counts = recent_df['day_of_week'].value_counts().to_dict()
        for day, count in daily_counts.items():
            temporal_patterns['daily'][day] = int(count)

        # Energy by hour (if we have audio features)
        if not features_df.empty and 'track_id' in recent_df.columns:
            recent_with_features = recent_df.merge(
                features_df,
                left_on='track_id',
                right_on='track_id',
                how='inner'
            )

            if not recent_with_features.empty:
                energy_by_hour = recent_with_features.groupby('hour')['energy'].mean().to_dict()
                temporal_patterns['energy_by_hour'] = {int(k): float(v) for k, v in energy_by_hour.items()}

    # --- MOOD CLASSIFICATION ---
    mood_distribution = {
        'energetic': 0,
        'calm': 0,
        'happy': 0,
        'sad': 0,
        'danceable': 0
    }

    if not features_df.empty:
        total = len(features_df)
        mood_distribution['energetic'] = int((features_df['energy'] > 0.6).sum() / total * 100)
        mood_distribution['calm'] = int((features_df['energy'] < 0.4).sum() / total * 100)
        mood_distribution['happy'] = int((features_df['valence'] > 0.6).sum() / total * 100)
        mood_distribution['sad'] = int((features_df['valence'] < 0.4).sum() / total * 100)
        mood_distribution['danceable'] = int((features_df['danceability'] > 0.7).sum() / total * 100)

    # --- LISTENING DIVERSITY ---
    diversity_score = 0
    if not top_artists:
        diversity_score = 0
    else:
        # Calculate Herfindahl index (lower = more diverse)
        total_listens = sum([a['count'] for a in top_artists])
        herfindahl = sum([(a['count'] / total_listens) ** 2 for a in top_artists])
        diversity_score = int((1 - herfindahl) * 100)

    # --- ARTIST COLLABORATION NETWORK ---
    # Analyze which artists you listen to together
    artist_pairs = []
    if not top_df.empty:
        for _, track in top_df.iterrows():
            artists = track.get('artists', [])
            artist_names = [a.get('name', 'Unknown') for a in artists]
            if len(artist_names) > 1:
                # Track features multiple artists
                for pair in combinations(artist_names, 2):
                    artist_pairs.append(tuple(sorted(pair)))

    collaboration_network = []
    if artist_pairs:
        pair_counts = Counter(artist_pairs)
        collaboration_network = [
            {'artists': list(pair), 'tracks': count}
            for pair, count in pair_counts.most_common(5)
        ]

    # --- LISTENING VELOCITY & PATTERNS ---
    listening_velocity = {
        'tracks_per_day': 0,
        'most_active_hour': 0,
        'most_active_day': 0,
        'listening_streak': 0
    }

    if not recent_df.empty and 'played_at' in recent_df.columns:
        try:
            recent_df['played_at'] = pd.to_datetime(recent_df['played_at'])
            recent_df['date'] = recent_df['played_at'].dt.date

            # Calculate tracks per day
            date_range = (recent_df['played_at'].max() - recent_df['played_at'].min()).days + 1
            listening_velocity['tracks_per_day'] = round(len(recent_df) / max(date_range, 1), 1)

            # Most active hour
            if 'hour' in recent_df.columns and len(recent_df['hour'].mode()) > 0:
                listening_velocity['most_active_hour'] = int(recent_df['hour'].mode().iloc[0])

            # Most active day (0=Monday, 6=Sunday)
            if 'day_of_week' in recent_df.columns and len(recent_df['day_of_week'].mode()) > 0:
                listening_velocity['most_active_day'] = int(recent_df['day_of_week'].mode().iloc[0])

            # Calculate listening streak (consecutive days with activity)
            unique_dates = sorted(recent_df['date'].unique())
            if len(unique_dates) > 0:
                current_streak = 1
                max_streak = 1
                for i in range(1, len(unique_dates)):
                    if (unique_dates[i] - unique_dates[i-1]).days == 1:
                        current_streak += 1
                        max_streak = max(max_streak, current_streak)
                    else:
                        current_streak = 1
                listening_velocity['listening_streak'] = max_streak
        except Exception as e:
            print(f"Error in listening velocity: {e}", file=sys.stderr)

    # --- GENRE EVOLUTION (How genres change over time) ---
    genre_evolution = []
    if not recent_df.empty and 'played_at' in recent_df.columns:
        try:
            recent_df['played_at'] = pd.to_datetime(recent_df['played_at'])
            recent_df['week'] = recent_df['played_at'].dt.isocalendar().week

            # Get genres for each track if available in recent tracks
            genre_by_week = {}
            for _, track in recent_df.iterrows():
                week = track.get('week', 0)
                artists = track.get('artists', [])
                for artist in artists:
                    for genre in artist.get('genres', []):
                        if week not in genre_by_week:
                            genre_by_week[week] = Counter()
                        genre_by_week[week][genre] += 1

            # Get top genre per week
            for week in sorted(genre_by_week.keys())[-4:]:  # Last 4 weeks
                if genre_by_week[week]:
                    top_genre = genre_by_week[week].most_common(1)[0]
                    genre_evolution.append({
                        'week': int(week),
                        'genre': top_genre[0],
                        'count': top_genre[1]
                    })
        except Exception as e:
            print(f"Error in genre evolution: {e}", file=sys.stderr)

    # --- ARTIST LOYALTY SCORE ---
    # How often do you re-listen to the same artists?
    artist_loyalty = 0
    if not recent_df.empty:
        try:
            all_recent_artists = []
            for _, track in recent_df.iterrows():
                artists = track.get('artists', [])
                all_recent_artists.extend([a.get('name', 'Unknown') for a in artists])

            if all_recent_artists:
                unique_artists = len(set(all_recent_artists))
                total_artist_plays = len(all_recent_artists)
                # Higher score = more loyalty (repeat listening)
                artist_loyalty = int((1 - (unique_artists / total_artist_plays)) * 100)
        except Exception as e:
            print(f"Error in artist loyalty: {e}", file=sys.stderr)

    # --- TRACK REPETITION ANALYSIS ---
    track_repetition = {
        'unique_tracks': 0,
        'total_plays': 0,
        'most_repeated_track': None,
        'repetition_rate': 0
    }

    if not recent_df.empty and 'track_id' in recent_df.columns:
        try:
            track_counts = recent_df['track_id'].value_counts()
            track_repetition['unique_tracks'] = len(track_counts)
            track_repetition['total_plays'] = len(recent_df)
            if len(recent_df) > 0:
                track_repetition['repetition_rate'] = int((1 - (len(track_counts) / len(recent_df))) * 100)

            # Get most repeated track info
            if not track_counts.empty:
                most_repeated_id = track_counts.idxmax()
                most_repeated_track = recent_df[recent_df['track_id'] == most_repeated_id].iloc[0]
                track_repetition['most_repeated_track'] = {
                    'name': most_repeated_track.get('name', 'Unknown'),
                    'plays': int(track_counts.max())
                }
        except Exception as e:
            print(f"Error in track repetition: {e}", file=sys.stderr)

    # --- LISTENING TIME DISTRIBUTION ---
    time_distribution = {
        'morning': 0,    # 6-12
        'afternoon': 0,  # 12-17
        'evening': 0,    # 17-22
        'night': 0       # 22-6
    }

    if not recent_df.empty and 'hour' in recent_df.columns:
        total = len(recent_df)
        time_distribution['morning'] = int(((recent_df['hour'] >= 6) & (recent_df['hour'] < 12)).sum() / total * 100)
        time_distribution['afternoon'] = int(((recent_df['hour'] >= 12) & (recent_df['hour'] < 17)).sum() / total * 100)
        time_distribution['evening'] = int(((recent_df['hour'] >= 17) & (recent_df['hour'] < 22)).sum() / total * 100)
        time_distribution['night'] = int(((recent_df['hour'] >= 22) | (recent_df['hour'] < 6)).sum() / total * 100)

    # --- RETURN ALL METRICS ---
    return {
        'audio_stats': audio_stats,
        'top_artists': top_artists,
        'top_genres': top_genres,
        'temporal_patterns': temporal_patterns,
        'mood_distribution': mood_distribution,
        'diversity_score': diversity_score,
        'total_tracks_analyzed': len(features_df),
        'collaboration_network': collaboration_network,
        'listening_velocity': listening_velocity,
        'genre_evolution': genre_evolution,
        'artist_loyalty': artist_loyalty,
        'track_repetition': track_repetition,
        'time_distribution': time_distribution
    }


if __name__ == '__main__':
    # Read JSON input from stdin
    input_data = json.loads(sys.stdin.read())

    # Analyze
    results = analyze_listening_data(input_data)

    # Output JSON to stdout
    print(json.dumps(results, indent=2))
