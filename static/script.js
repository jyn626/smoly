const form = document.querySelector('form')


form.addEventListener('submit', async (e) => {
  e.preventDefault(); // Prevent page reload

  const formData = new FormData(form);

  const response = await fetch("/analyze", {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  const song_data = data.data
  console.log(data);
  console.log(song_data.lines);

  if (song_data) {
    const results_container = document.getElementById("results")

    const themeColors = {
      "nostalgia": "#FFE8CC",
      "heartbreak": "#FFB3B3",
      "hope": "#B3E5FC",
      "loneliness": "#ADD8E6"
    }

    song_data.lines && song_data.lines.forEach((line) => {
      // get all the score
      const scores = line.theme_scores.map((theme) => theme.score)
      const maxScore = Math.max(...scores)
      console.log(maxScore)
      const bestTheme = line.theme_scores.filter((theme) => theme.score == maxScore)[0].theme
      console.log(bestTheme)
      const bgColor = themeColors[bestTheme] || "#FFFFFF"
      results_container.innerHTML += `<mark style="background-color: ${bgColor};">${line.line}</mark><br>`
    })

  }
})