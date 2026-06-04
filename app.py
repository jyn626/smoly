from flask import Flask, render_template, request, redirect
from werkzeug.utils import secure_filename
from sentence_transformers import SentenceTransformer, util
from flask.json import jsonify
from mutagen.easyid3 import EasyID3
import os
import librosa
import numpy as np
import syncedlyrics
import json
import uuid
from dotenv import load_dotenv
import requests

load_dotenv()

LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY")

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)
lastfm_base = "http://ws.audioscrobbler.com/2.0/"
data = {}

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
    "despair": "hopelessness and deep darkness"
}


def transcribe(audio_file):
    print("transcribing...")

    filename_without_ext = audio_file.rsplit('.', 1)[0].split('/')[-1]

    try:
        audio = EasyID3(audio_file)
        artist = audio.get('artist', [''])[0]
        track = audio.get('title', [''])[0] or filename_without_ext

        track = " ".join(word.capitalize() for word in track.split(" "))
        print(track)
        print(artist)

        if artist:

            search_query = f"{track} {artist}"

            # get tags using last.fm api :)
            params = {
                "method": "track.getTopTags",
                "artist": artist,
                "track": track,
                "api_key": LASTFM_API_KEY,
                "format": "json"
            }
            try:

                response = requests.get(lastfm_base, params=params, timeout=10)
                print(response)
                response.raise_for_status()
                _data = response.json()

                if "error" in _data:
                    print(f"Last.fm Error {data['error']}: {data['message']}")

                print(_data)

                output_fname = uuid.uuid4()
                with open(f'./outputs/tags/{output_fname}.json', "w") as f:
                    json.dump(_data, f, indent=2)
            except requests.exceptions.HTTPError as err:
                print(f"HTTP error occurred: {err}")

        else:
            search_query = filename_without_ext

    except Exception as e:
        print(f"Metadata error: {e}")
        search_query = filename_without_ext

    lyrics = syncedlyrics.search(search_query)

    if not lyrics:
        return []

    lines = [line for line in lyrics.strip().split('\n') if line]
    data["lyrics"] = lyrics
    return lines


def beat_detection(audio_file):
    print("detecting beats...")
    global data
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

    if (bpm < 80): pace = "Slow"
    elif (bpm > 80 and bpm < 120): pace = "Medium"
    else: pace = "Fast"

    if (avg_rms < 0.05): energy = "Quiet"
    elif (avg_rms > 0.05 and avg_rms < 0.15): energy = "Medium"
    else:
        energy = "Loud"

    data['tempo'] = "%.2f BPM" % (bpm)
    data['pace'] = pace
    data['duration'] = "%.2fs" % (duration)
    data['energy'] = energy
    data['dynamic_range'] = "%.2f dB" % (dynamic_range)


@app.route("/")
def index():
    return render_template('index.html')


@app.route("/analyze", methods=["POST"])
def analyze():

    file = request.files.get("file")

    if not file:
        return jsonify({
            "success": False,
            "message": "No file uploaded"
        }), 400

    if file.filename == "":
        return jsonify({
            "success": False,
            "message": "No file selected"
        }), 400

    filename = secure_filename(file.filename)

    path = os.path.join(
        app.config["UPLOAD_FOLDER"],
        filename
    )

    file.save(path)

    try:
        print('==== processing ====')
        audio_file = path
        beat_detection(audio_file)

        lines = transcribe(audio_file)
        lines_embedding = model.encode(lines)

        overall_theme_score = {theme: 0 for theme in themes}

        # overall theme
        for theme, desc in themes.items():
            print(theme)
            similarities = util.cos_sim(model.encode(desc), model.encode(data["lyrics"]))
            overall_theme_score[theme] += similarities.item()

        data['lines'] = []

        for (line, embedding) in zip(lines, lines_embedding):
            """ Get theme for each line """
            _line = {
                "line": line.strip(),
                "theme_scores": []
            }

            for theme, desc in themes.items():
                similarities = util.cos_sim(embedding, model.encode(desc))

                _line["theme_scores"].append({
                "theme": theme,
                "score": similarities.item()
                })

            data['lines'].append(_line)
        data['overall_theme_score'] = overall_theme_score

        output_fname = uuid.uuid4()
        with open(f'./outputs/{output_fname}.json', "w") as f:
            json.dump(data, f, indent=2)

    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

    return jsonify({
        "success": True,
        "message": "File uploaded successfully",
        "filename": filename,
        "data": data
    })
