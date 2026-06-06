window.addEventListener('DOMContentLoaded', () => {

  const noticeDropdownBtn = document.getElementById('notice-dropdown-btn')
  const fileInput = document.getElementById('file_input')
  const results_container = document.getElementById("results")
  const audioEl = document.getElementById('audio')
  const lyricsVisualizer = document.getElementById('lyrics-visualizer')
  let timestamps = []
  let lines = []

  const themeColors = {
    "nostalgia": "#FFE8CC",
    "heartbreak": "#FFD7D7",
    "hope": "#C7E9F5",
    "loneliness": "#D0E8F2",
    "love": "#FFD9E8",
    "joy": "#FFFBEA",
    "sadness": "#D9E3F0",
    "anger": "#FFD9B3",
    "empowerment": "#D9F0D0",
    "loss": "#E8D9F0",
    "freedom": "#C7E9F5",
    "regret": "#E8E8E8",
    "despair": "#D9D9D9"
  }

  function formatTimestamp(ts) {
    let newTs = ts.replace('[', '')
    newTs = newTs.replace(']', '')

    let [minute, seconds] = newTs.split(":")

    return parseInt(minute) * 60 + parseFloat(seconds)
  }

  async function handleUpload() {
    timestamps = []
    lines = []
    lyricsVisualizer.innerHTML = ""
    results_container.innerHTML = ""
    const loading = document.getElementById("loading")

    loading.style.display = 'block'
    const file = fileInput.files[0]
    const formData = new FormData()
    if (fileInput.files.length > 0) {
      formData.append('file', file)
    }

    const audioUrl = URL.createObjectURL(file)
    audioEl.src = audioUrl
    audio.load()


    try {
      const response = await fetch("/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      const song_data = data.data
      let topTags = data.top_tags.tag
      console.log(data)
      lyrics = song_data.lyrics

      if (song_data) {
        audio.style.display = 'block'
        if (!song_data.lines || song_data.lines.length === 0) {
          results_container.innerHTML += '<p style="color: red;">Lyrics cannot be found. Please try again.</p>'
          return
        }

        results_container.innerHTML += `
        <div class="song_analysis_container">
          <h3 class="title"style="margin-top: 0;">Song Analysis</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.95em;">
            <div><strong>Tempo:</strong> ${song_data.tempo}</div>
            <div><strong>Pace:</strong> ${song_data.pace}</div>
            <div><strong>Duration:</strong> ${song_data.duration}</div>
            <div><strong>Energy:</strong> ${song_data.energy}</div>
            <div><strong>Dynamic Range:</strong> ${song_data.dynamic_range}</div>
          </div>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
            <h4 style="margin-top: 0; margin-bottom: 8px;">Overall Theme Rating</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.9em;">
              ${Object.entries(song_data.overall_theme_score).map(([theme, score]) =>
              `<div><strong>${theme}:</strong> ${(score * 100).toFixed(2)}%</div>`
              ).join('')}
            </div>
          </div>

          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd;">
            <h4 style="margin-top: 0; margin-bottom: 8px;">Top tags</h4>
            <div style="display: flex; flex-wrap: wrap; flex-direction: row; gap:4px; ">${
              topTags.length > 0 ?
              topTags.map((tag) => `<p>${tag.name}</p>`)
              : `<p>There are no <b>top tags</b> for this track.</p>`
            }</div>
          </div>
        </div>`

        song_data.lines && song_data.lines.forEach((line_data) => {
          const scores = line_data.theme_scores.map((theme) => theme.score)
          const line = line_data.line.split(' ').slice(1).join(' ')

          if (line == '') return;

          const timestamp = line_data.line.split(' ')[0]
          timestamps.push(formatTimestamp(timestamp))
          lines.push(line)
          const maxScore = Math.max(...scores)
          const bestThemeObj = line_data.theme_scores.filter((theme) => theme.score == maxScore)[0]
          const bestTheme = bestThemeObj.theme
          const bestScore = (bestThemeObj.score * 100).toFixed(0)
          const bgColor = themeColors[bestTheme] || "#FFFFFF"
          results_container.innerHTML += `
            <span
              style="
                background-color: ${bgColor};
                padding: 2px 4px;
                border-radius: 2px;
                margin-right: 8px;
                font-size: 0.8em;
                display: inline-block;
                font-weight: lighter;
                color: #333;
                "
                >${timestamp}</span><mark style="background-color: ${bgColor};">${line} <sup style="font-size: 0.7em; opacity: 0.7;">${bestTheme} ${bestScore}%</sup></mark><br>`
        })

        console.log(timestamps)
        console.log(lines)
      }

    } catch (error) {
      results_container.innerHTML = ""
      console.log(error)
    } finally {
      loading.style.display = 'none'
    }

  }

  noticeDropdownBtn.addEventListener('click', () => {
    document.getElementById('notice').classList.toggle('active')
  })


  fileInput.addEventListener('change', handleUpload)

  let currentIndex = -1
  // audio events
  audioEl.addEventListener('timeupdate', () => {
    seconds  = audioEl.currentTime

    console.log(seconds)
    let offset = -0.35
    let index = 0

    for (let i = 0; i < timestamps.length; i++) {
      if (seconds >= timestamps[i] + offset) {
        index = i
      } else {
        break
      }

    }

    console.log(lines[currentIndex])
    if (currentIndex !== index) {
      currentIndex = index
      if (lines[currentIndex]) {
        lyricsVisualizer.innerHTML = `<p class="lyrics">${lines[currentIndex]}</p>`
      }
    }



  })

})
