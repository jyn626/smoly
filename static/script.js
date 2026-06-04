const form = document.querySelector('form')
const results_container = document.getElementById("results")

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

const legendHtml = Object.entries(themeColors).map(([theme, color]) =>
  `<span style="display: inline-block; margin-right: 4px; margin-bottom: 8px;">
    <span style="background-color: ${color}; padding: 3px 6px; border-radius: 2px; font-size: 0.85em; font-weight: light; color: #333;">${theme}</span>
  </span>`
).join('')

results_container.innerHTML = `<div style="margin-bottom: 20px; padding: 10px; border-radius: 4px;">${legendHtml}</div>`


form.addEventListener('submit', async (e) => {
  e.preventDefault(); // Prevent page reload

  const loading = document.getElementById("loading")
  const results_container = document.getElementById("results")
  const submitBtn = form.querySelector('button[type="submit"]')

  loading.style.display = 'block'
  // results_container.innerHTML = `<div style="margin-bottom: 20px; padding: 10px; background-color: #f9f9f9; border-radius: 4px;">${legendHtml}</div>`
  submitBtn.disabled = true

  const formData = new FormData(form);

  const response = await fetch("/analyze", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  const song_data = data.data
  console.log(data);
  console.log(song_data.lines);

  loading.style.display = 'none'
  submitBtn.disabled = false

  if (song_data) {
    if (!song_data.lines || song_data.lines.length === 0) {
      results_container.innerHTML = '<p style="color: red;">Lyrics cannot be found. Please try again.</p>'
      return
    }

    const legendHtml = Object.entries(themeColors).map(([theme, color]) =>
      `<span style="display: inline-block; margin-right: 15px; margin-bottom: 8px;">
        <span style="background-color: ${color}; padding: 3px 6px; border-radius: 4px; font-size: 0.85em; font-weight: bold; color: #333;">${theme}</span>
      </span>`
    ).join('')

    results_container.innerHTML += `<div style="margin-bottom: 20px; padding: 15px; border:1px solid #f0f0f0; border-radius: 4px;">
      <h3 style="margin-top: 0;">Song Analysis</h3>
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
      `<div><strong>${theme}:</strong> ${score.toFixed(2)}</div>`
    ).join('')}
        </div>
      </div>
    </div>`

    song_data.lines && song_data.lines.forEach((line_data) => {
      // get all the score
      const scores = line_data.theme_scores.map((theme) => theme.score)
      const line = line_data.line.split(' ').slice(1).join(' ')
      const timestamp = line_data.line.split(' ')[0]
      const maxScore = Math.max(...scores)
      console.log(maxScore)
      const bestThemeObj = line_data.theme_scores.filter((theme) => theme.score == maxScore)[0]
      const bestTheme = bestThemeObj.theme
      const bestScore = (bestThemeObj.score * 100).toFixed(0)
      console.log(bestTheme)
      const bgColor = themeColors[bestTheme] || "#FFFFFF"
      results_container.innerHTML += `
        <span
          style="
            background-color: ${bgColor};
            padding: 3px 6px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-right: 8px;
            display: inline-block;
            font-weight: bold;
            color: #333;
            "
            >${timestamp}</span><mark style="background-color: ${bgColor};">${line} <sup style="font-size: 0.7em; opacity: 0.7;">${bestTheme} ${bestScore}%</sup></mark><br>`
    })

  }
})