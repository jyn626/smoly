import hashlib
import json
import os
import uuid

import librosa
import numpy as np
import requests
import textstat
from dotenv import load_dotenv
from flask import Flask, render_template, request
from flask.json import jsonify
from google import genai
from mutagen.easyid3 import EasyID3
from sentence_transformers import SentenceTransformer, util
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from werkzeug.utils import secure_filename

load_dotenv()

LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY")

app = Flask(__name__)
UPLOAD_FOLDER = "uploads"

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

model = SentenceTransformer("all-MiniLM-L6-v2")

client = genai.Client(api_key=GEMINI_API_KEY)
# chat = client.chats.create(model="gemini-3.5-flash")

lrclib_base = "https://lrclib.net/api"

lastfm_base = "http://ws.audioscrobbler.com/2.0/"
analyzer = SentimentIntensityAnalyzer()

CACHE_DIR = "cache"
os.makedirs(CACHE_DIR, exist_ok=True)

data = {}
artist, track = "", ""


def get_file_hash(filepath):
    sha = hashlib.sha256()

    with open(filepath, "rb") as f:
        while True:
            chunk = f.read(8192)

            if chunk:
                sha.update(chunk)
            else:
                break

    return sha.hexdigest()


def load_cache(file_hash):
    cache_path = os.path.join(CACHE_DIR, f"{file_hash}.json")

    if not os.path.exists(cache_path):
        return None

    with open(cache_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_cache(file_hash, data):
    cache_path = os.path.join(CACHE_DIR, f"{file_hash}.json")

    with open(cache_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)


def ai_analyze(lyrics):
    prompt = f"""
		You are an expert music and lyric analyst.

		Analyze the following song lyrics.

		Instructions:
		1. Ignore timestamps such as [00:16.19].
		2. Group lyrics into logical verses, choruses, bridges, and outro sections.
		3. Explain the meaning of each section in 1-3 concise sentences.
		4. Focus on emotions, imagery, symbolism, themes, and the story being told.
		5. Do not explain every line individually unless necessary.
		6. Keep explanations easy to understand.
		7. Return ONLY valid JSON. Do not include markdown or code fences.

		Return this exact structure:

		{{
		  "title": "",
		  "overall_summary": "",
		  "themes": [],
		  "mood": "",
		  "sections": [
			{{
			  "section_name": "",
			  "lyrics": "",
			  "explanation": "",
			  "emotion": ""
			}}
		  ]
		}}

		Lyrics:

		{lyrics}
	"""

    response = client.models.generate_content(
        model="gemini-3.1-flash-lite", contents=prompt
    )

    print(response.text)

    return response.text


# TODO: add more themes later, or configure this to uhh increase accuracy maybe
themes = {
    "nostalgia": "longing for the past and meaningful memories",
    "heartbreak": "emotional pain caused by losing someone",
    "hope": "belief in a better future",
    "loneliness": "feeling isolated and disconnected from others",
    "love": "romantic feelings and affection",
    "joy": "happiness and celebration",
    "sadness": "deep sorrow and melancholy",
    "anger": "rage, frustration, and resentment",
    "empowerment": "strength, confidence, and self-belief",
    "loss": "grief and mourning",
    "freedom": "liberation and breaking free",
    "regret": "remorse and wishing things were different",
    "despair": "hopelessness and deep darkness",
}


def fetch_lyrics_from_lrclib(track_name, artist_name):
    try:
        res = requests.get(
            f"{lrclib_base}/get?track_name={track_name}&artist_name=${artist_name}"
        )
        if res.status_code == 200:
            data = res.json()
            print(data["syncedLyrics"])

            return data["syncedLyrics"]
        return None
    except Exception as e:
        print(e)


def get_lines(lyrics):
    lines = [line for line in lyrics.strip().split("\n") if line]
    return lines


def get_top_tags(artist, track):
    # get tags using last.fm api :)
    params = {
        "method": "track.getTopTags",
        "artist": artist,
        "track": track,
        "api_key": LASTFM_API_KEY,
        "format": "json",
    }
    try:
        response = requests.get(lastfm_base, params=params, timeout=10)
        print(response)
        response.raise_for_status()
        data = response.json()

        if "error" in data:
            print(f"Last.fm Error {data['error']}: {data['message']}")

        print(data)

        output_fname = uuid.uuid4()
        with open(f"./outputs/tags/{output_fname}.json", "w") as f:
            json.dump(data, f, indent=2)

        return data
    except requests.exceptions.HTTPError as err:
        print(f"HTTP error occurred: {err}")


def extract_metadata(audio_file):
    global artist, track
    try:
        audio = EasyID3(audio_file)

        if audio is not None:
            artist = audio.get("artist", [""])[0]
            track = audio.get("title", [""])[0] or filename_without_ext

        if not artist or not track:
            # TODO: implement a fallback function
            return None

        # capitalize title
        track = " ".join(word.capitalize() for word in track.split(" "))
        return artist, track
    except Exception as e:
        print(f"Error extracting metadata: {e}")


def get_mood(lyrics):
    sentiment = analyzer.polarity_scores(lyrics)
    compound = sentiment["compound"]
    mood = ""
    if compound >= 0.5:
        mood = "Very Positive"
    elif compound >= 0.2:
        mood = "Positive"
    elif compound > -0.2:
        mood = "Balanced"
    elif compound > -0.5:
        mood = "Melancholic"
    else:
        mood = "Very Emotional"
    print(mood)

    return mood


def get_lyrics(audio_file):
    print("transcribing...")
    filename_without_ext = audio_file.rsplit(".", 1)[0].split("/")[-1]
    lyrics = None

    artist, track = extract_metadata(audio_file)

    if artist and track:
        lyrics = fetch_lyrics_from_lrclib(track, artist)
        print(lyrics)

    if not lyrics:
        return []

    return lyrics
    # return lyrics, lines, top_tags["toptags"], mood


def detect_bpm(audio_file):
    print("detecting beats...")
    y, sr = librosa.load(audio_file)

    pace = ""
    energy = ""

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    bpm = tempo[0]
    duration = librosa.get_duration(y=y, sr=sr)

    rms = librosa.feature.rms(y=y)
    avg_rms = np.mean(rms)

    rms_db = librosa.amplitude_to_db(rms)
    dynamic_range = np.max(rms_db) - np.min(rms_db)

    if bpm < 80:
        pace = "Slow"
    elif bpm > 80 and bpm < 120:
        pace = "Medium"
    else:
        pace = "Fast"

    if avg_rms < 0.05:
        energy = "Quiet"
    elif avg_rms > 0.05 and avg_rms < 0.15:
        energy = "Medium"
    else:
        energy = "Loud"

    data["tempo"] = "%.2f BPM" % (bpm)
    data["pace"] = pace
    data["duration"] = "%.2fs" % (duration)
    data["energy"] = energy
    data["dynamic_range"] = "%.2f dB" % (dynamic_range)


def rate_overall_theme(lyrics, themes):
    if not lyrics:
        return

    overall_theme_score = {theme: 0 for theme in themes}

    # overall theme
    for theme, desc in themes.items():
        similarities = util.cos_sim(model.encode(desc), model.encode(data["lyrics"]))
        overall_theme_score[theme] += similarities.item()

    return overall_theme_score


def get_line_sylabbles_count(line):
    return textstat.syllable_count(line)


def rate_line_theme(line, embedding):
    """Get theme and total syllables for a single line"""

    total_syllables = get_line_sylabbles_count(line)

    _line = {
        "line": line.strip(),
        "theme_scores": [],
        "total_syllables": total_syllables - 1,
    }

    for theme, desc in themes.items():
        similarities = util.cos_sim(embedding, model.encode(desc))
        _line["theme_scores"].append(
            {
                "theme": theme,
                "score": similarities.item(),
            }
        )

    return _line


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    data.clear()
    data["lines"] = []

    file = request.files.get("file")

    if not file:
        return jsonify({"success": False, "message": "No file uploaded"}), 400

    if file.filename == "":
        return jsonify({"success": False, "message": "No file selected"}), 400

    filename = secure_filename(file.filename)

    path = os.path.join(app.config["UPLOAD_FOLDER"], filename)

    file.save(path)

    try:
        print("==== checking cache ====")
        file_fingerprint = get_file_hash(path)

        cached_data = load_cache(file_fingerprint)

        if cached_data is not None:
            print("CACHE HIT")
            print(cached_data)
            return jsonify(
                {"success": True, "filename": filename, "data": cached_data["data"]}
            )

        print("==== processing ====")

        audio_file = path
        detect_bpm(audio_file)

        # lyrics, lines, top_tags, mood = get_lyrics(audio_file)
        lyrics = get_lyrics(audio_file)
        lines = get_lines(lyrics)
        top_tags = get_top_tags(artist, track)
        mood = get_mood(lyrics)
        overall_theme_score = rate_overall_theme(lyrics, themes)
        lines_embedding = model.encode(lines)

        for line, embedding in zip(lines, lines_embedding):
            _line = rate_line_theme(line, embedding)
            data["lines"].append(_line)

        data["lyrics"] = lyrics
        data["mood"] = mood
        data["overall_theme_score"] = overall_theme_score

        data["ai_analysis"] = json.loads(ai_analyze(lyrics))
        data["top_tags"] = top_tags

        output_fname = uuid.uuid4()

        with open(f"./outputs/{output_fname}.json", "w") as f:
            json.dump(data, f, indent=2)

        save_cache(
            file_fingerprint,
            {"data": data},
        )

    except Exception as e:
        print(f"POST /analyze ERROR: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

    return jsonify({"success": True, "filename": filename, "data": data})
