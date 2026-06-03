const form = document.querySelector('form')


form.addEventListener('submit', async (e) => {
  e.preventDefault(); // Prevent page reload

  const loading = document.getElementById("loading")
  const results_container = document.getElementById("results")
  const submitBtn = form.querySelector('button[type="submit"]')

  loading.style.display = 'block'
  results_container.innerHTML = ''
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

    const themeColors = {
      "nostalgia": "#FFE8CC",
      "heartbreak": "#FFB3B3",
      "hope": "#B3E5FC",
      "loneliness": "#ADD8E6"
    }

    song_data.lines && song_data.lines.forEach((line_data) => {
      // get all the score
      const scores = line_data.theme_scores.map((theme) => theme.score)
      const line = line_data.line.split(' ').slice(1).join(' ')
      const timestamp = line_data.line.split(' ')[0]
      const maxScore = Math.max(...scores)
      console.log(maxScore)
      const bestTheme = line_data.theme_scores.filter((theme) => theme.score == maxScore)[0].theme
      console.log(bestTheme)
      const bgColor = themeColors[bestTheme] || "#FFFFFF"
      results_container.innerHTML += `<small>${timestamp}</small><mark style="background-color: ${bgColor};  ">${line}</mark><br>`
    })

  }
})