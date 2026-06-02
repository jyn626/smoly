from flask import Flask, render_template, request, redirect
from werkzeug.utils import secure_filename
import os
from flask.json import jsonify
import librosa
import numpy as np
from faster_whisper import WhisperModel
from sentence_transformers import SentenceTransformer, util
import json
import uuid

app = Flask(__name__)
UPLOAD_FOLDER = 'uploads'

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# def allowed_file(filename):
#     return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)

# Whisper
# model_size = "large-v3"
w_model = WhisperModel(
    "base",
    device="cpu",
    compute_type="int8"
)

# Keane - Somewhere Only We Know.mp3
audio_file = "No Other Heart - Mac DeMarco.mp3"
data = {}

themes = {
    "nostalgia": "longing for the past and meaningful memories",
    "heartbreak": "emotional pain caused by losing someone",
    "hope": "belief in a better future",
    "loneliness": "feeling isolated and disconnected from others"
}


def transcribe(audio_file):

    segments, t = w_model.transcribe(audio_file, word_timestamps=True)
    # words_timeline = []
    # lyrics_timeline = [] 
    lines = []
    lyrics = ""
    
    for segment in segments:
        lines.append(segment.text)
        
        # lyrics_timeline.append({
        #     "start": segment.start,
        #     "word": segment.text,
        #     "end": segment.end
        # })
        
        lyrics += segment.text + '\n'

    # for word in segment.words:
    #     words_timeline.append(
    #     {
    #         "start": word.start,
    #         "word": word.word,
    #         "end": word.end
    #     }
    #     ) 
        
    # print("[%.2fs -> %.2fs]: %s", (word.start, word.end, word.word))
    data["lyrics"] = lyrics
    return lines


def beat_detection(audio_file):
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

    if (bpm < 80): pace = "slow"
    elif (bpm > 80 and bpm < 120): pace = "medium"
    else: pace = "fast"

    if (avg_rms < 0.05): energy = "quiet"
    elif (avg_rms > 0.05 and avg_rms < 0.15): energy = "medium"
    else:
        energy = "loud"
    
    data['tempo'] = "%.2f BPM" % (bpm)
    data['pace'] = pace
    data['duration'] = "%.2fs" % (duration)
    data['energy'] = energy
    data['dynamic_range'] = "%.2f dB" % (dynamic_range)

# full_lyrics = "\n".join(lines)
# lines_embedding = model.encode(lines)

# print('Saved file')


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
        audio_file = './uploads/' + filename
        beat_detection(audio_file)
        
        lines = transcribe(audio_file)
        lines_embedding = model.encode(lines)
        
        overall_theme_score = {theme: 0 for theme in themes}
        
        # overall theme
        for theme, desc in themes.items():
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
