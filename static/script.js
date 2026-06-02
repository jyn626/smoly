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

    song_data.lines && song_data.lines.forEach((line) => {
      results_container.innerHTML += `${line.line}<br>`
    })

  }
})